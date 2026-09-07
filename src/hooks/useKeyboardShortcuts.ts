"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onNewTask?: () => void;
  onSearch?: () => void;
  onToggleTheme?: () => void;
  onShowShortcuts?: () => void;
  onToggleBar?: () => void;
  onToggleCalendar?: () => void;
  onToggleSchedule?: () => void;
  onNewRule?: () => void;
  onToggleTemplates?: () => void;
  onEscape?: () => void;
  /** Single-key shortcuts are off while a modal or panel is open */
  enabled?: boolean;
}

/* A dialog, panel or drawer is open somewhere in the page */
function modalIsOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"], [role="dialog"]');
}

export function useKeyboardShortcuts({
  onNewTask,
  onSearch,
  onToggleTheme,
  onShowShortcuts,
  onToggleBar,
  onToggleCalendar,
  onToggleSchedule,
  onNewRule,
  onToggleTemplates,
  onEscape,
  enabled = true,
}: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape closes what is open — it never hides the task input
      if (e.key === "Escape") {
        onEscape?.();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // Ctrl/Cmd+Shift+L → toggle dark mode (Cmd+D is the browser bookmark)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        onToggleTheme?.();
        return;
      }

      // Ignore when typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Cmd/Ctrl+K works everywhere, the rest are plain single keys
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearch?.();
        return;
      }

      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!enabled || modalIsOpen()) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          onShowShortcuts?.();
          break;
        case "n":
          e.preventDefault();
          onNewTask?.();
          break;
        case "/":
          e.preventDefault();
          onSearch?.();
          break;
        case "c":
          e.preventDefault();
          onToggleCalendar?.();
          break;
        case "s":
          e.preventDefault();
          onToggleSchedule?.();
          break;
        case "r":
          e.preventDefault();
          onNewRule?.();
          break;
        case "t":
          e.preventDefault();
          onToggleTemplates?.();
          break;
        case "b":
          e.preventDefault();
          onToggleBar?.();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewTask, onSearch, onToggleTheme, onShowShortcuts, onToggleBar, onToggleCalendar, onToggleSchedule, onNewRule, onToggleTemplates, onEscape, enabled]);
}
