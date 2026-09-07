"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

/**
 * One dialog for the whole app. Centred, at most 480 px unless it says
 * otherwise, head, body and foot. Esc closes it, focus stays inside while
 * it is open and goes back where it came from afterwards.
 */
export default function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** A wider dialog for things that need a table, e.g. the week planner. */
  width?: number;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    // Give focus to the panel so the first Tab lands inside it
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
      returnRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" role="presentation">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="dialog relative w-full flex flex-col max-h-[85dvh]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center gap-2 px-4 h-12 flex-none border-b border-border">
          <h2 className="flex-1 min-w-0 truncate text-base font-medium text-text">{title}</h2>
          <button onClick={onClose} className="icon-btn flex-none" aria-label={t("Close")}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 text-sm text-text-muted">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 flex-none border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
