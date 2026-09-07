"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

interface AppShellProps {
  /** Column 1. Hidden below 768 px, where the bottom navigation takes over. */
  nav: ReactNode;
  /** Column 2. Always visible, scrolls for itself. */
  content: ReactNode;
  /** Column 3. Always present from 1024 px up, a drawer or sheet below that. */
  detail: ReactNode;
  /**
   * Whether the detail panel is showing something. From 1024 px up the column
   * stays in the grid either way and shows its empty state; below that the
   * panel only appears when this is true.
   */
  detailOpen: boolean;
  /** Closes the drawer or sheet. Esc and the backdrop both call it. */
  onCloseDetail: () => void;
  /** Rendered outside the grid: bottom navigation, toasts, dialogs. */
  children?: ReactNode;
}

export default function AppShell({
  nav,
  content,
  detail,
  detailOpen,
  onCloseDetail,
  children,
}: AppShellProps) {
  const { t } = useI18n();
  // Esc closes the overlay forms of the panel. Above 1024 px the panel is a
  // column, not an overlay, so the dashboard handles Esc there itself.
  useEffect(() => {
    if (!detailOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (window.innerWidth >= 1024) return;
      onCloseDetail();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen, onCloseDetail]);

  return (
    <>
      <div className="app-shell">
        <div className="app-nav">{nav}</div>
        <div className="app-content">{content}</div>
        {/* Below 1024 px the panel is an overlay, so it is only in the tree
            when something is selected. Above it, the column is always there. */}
        <div className="app-detail" data-open={detailOpen ? "true" : "false"}>
          {/* As a full sheet the panel needs a way back that is not Esc */}
          <button onClick={onCloseDetail} className="btn btn-ghost md:hidden flex-none justify-start h-10 px-3 border-b border-border rounded-none">
            <ArrowLeft size={16} />
            {t("Back")}
          </button>
          {detail}
        </div>
      </div>
      {detailOpen && (
        <div
          className="app-detail-backdrop lg:hidden"
          onClick={onCloseDetail}
          aria-hidden="true"
        />
      )}
      {children}
    </>
  );
}
