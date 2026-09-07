"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * The phone gets the same navigation as the desktop, in a sheet from the left
 * instead of a column. Nothing about the navigation itself changes.
 */
export default function NavSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden">
      <div className="app-detail-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("Menu")}
        tabIndex={-1}
        className="fixed top-0 left-0 bottom-0 z-50 w-[280px] max-w-[85vw] flex flex-col surface border-r border-border focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}
