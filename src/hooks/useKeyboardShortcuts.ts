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
}: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // ? → show keyboard shortcuts (not while typing)
      if (e.key === "?" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }

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

      // C → toggle calendar & schedule panel (not while typing)
      if (e.key === "c" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleCalendar?.();
        return;
      }

      // S → toggle schedule week view (not while typing)
      if (e.key === "s" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleSchedule?.();
        return;
      }

      // R → new rule (not while typing)
      if (e.key === "r" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onNewRule?.();
        return;
      }

      // T → templates (not while typing)
      if (e.key === "t" && !isTyping && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleTemplates?.();
        return;
      }

      // Cmd+D / Ctrl+D → toggle dark mode
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        onToggleTheme?.();
        return;
      }

      // Escape → close panels + blur active element
      if (e.key === "Escape") {
        onEscape?.();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewTask, onSearch, onToggleTheme, onShowShortcuts, onToggleBar, onToggleCalendar, onToggleSchedule, onNewRule, onToggleTemplates, onEscape]);
}
