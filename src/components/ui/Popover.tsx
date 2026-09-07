"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Align = "start" | "end";

interface PopoverProps {
  /** The element the popover hangs from. Clicking it again closes the popover. */
  trigger: (props: { ref: (el: HTMLElement | null) => void; onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  /** Which edge of the trigger the popover lines up with. */
  align?: Align;
  /** Opened from outside, for a right-click menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
}

const GAP = 4;
const MARGIN = 8;

/**
 * One popover for the whole app: surface, 8 px radius, the popover shadow,
 * placed below the trigger unless the window is out of room, in which case it
 * flips above. Esc, a click outside and a second click on the trigger all
 * close it.
 */
export default function Popover({
  trigger,
  children,
  align = "start",
  open: controlledOpen,
  onOpenChange,
  label,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );

  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const trig = triggerRef.current;
    const panel = panelRef.current;
    if (!trig || !panel) return;

    const t = trig.getBoundingClientRect();
    const p = panel.getBoundingClientRect();

    // Below by default, above when the window has no room left
    const roomBelow = window.innerHeight - t.bottom - MARGIN;
    const top = roomBelow >= p.height || t.top - MARGIN < p.height
      ? t.bottom + GAP
      : t.top - p.height - GAP;

    let left = align === "end" ? t.right - p.width : t.left;
    left = Math.min(left, window.innerWidth - p.width - MARGIN);
    left = Math.max(MARGIN, left);

    setPos({ top: Math.max(MARGIN, top), left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => place();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return; // the trigger toggles itself
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, setOpen]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen]);

  return (
    <>
      {trigger({
        ref: (el) => { triggerRef.current = el; },
        onClick: (e) => { e.stopPropagation(); setOpen(!open); },
        "aria-expanded": open,
      })}
      {open && mounted && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          className="popover fixed z-50"
          style={{
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            // Until it is measured it must not flash in the wrong place
            visibility: pos ? "visible" : "hidden",
          }}
        >
          {children(close)}
        </div>,
        document.body
      )}
    </>
  );
}

/** One line in a popover menu. */
export function PopoverItem({
  icon,
  children,
  onClick,
  danger = false,
  shortcut,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2 h-8 px-2 rounded text-[13px] hover:bg-surface-2 transition-default"
      style={{ color: danger ? "var(--danger)" : "var(--text)" }}
    >
      {icon}
      <span className="flex-1 text-left truncate">{children}</span>
      {shortcut && <span className="text-xs text-text-faint">{shortcut}</span>}
    </button>
  );
}
