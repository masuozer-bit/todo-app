"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onNewTask?: () => void;
  onSearch?: () => void;
  onToggleTheme?: () => void;
}

export function useKeyboardShortcuts({
  onNewTask,
  onSearch,
  onToggleTheme,
}: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // N → focus new task input (not while typing)
      if (e.key === "n" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onNewTask?.();
        return;
      }

      // / or Cmd+K → focus search (not while typing)
      if (
        (e.key === "/" && !isTyping) ||
        ((e.metaKey || e.ctrlKey) && e.key === "k")
      ) {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // Cmd+D / Ctrl+D → toggle dark mode
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        onToggleTheme?.();
        return;
      }

      // Escape → blur active element (close panels)
      if (e.key === "Escape" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewTask, onSearch, onToggleTheme]);
}
