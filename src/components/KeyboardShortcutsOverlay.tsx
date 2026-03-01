"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ["N"], description: "New task" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["Cmd", "K"], description: "Focus search" },
  { keys: ["Cmd", "D"], description: "Toggle dark mode" },
  { keys: ["?"], description: "Show shortcuts" },
  { keys: ["Esc"], description: "Close / blur" },
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-medium rounded-md bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-black dark:text-white">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsOverlay({
  open,
  onClose,
}: KeyboardShortcutsOverlayProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-black dark:text-white">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.description + shortcut.keys.join("+")}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-xs text-gray-300 dark:text-gray-600">
                        +
                      </span>
                    )}
                    <Key>{key}</Key>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-5 text-center">
          Press <Key>?</Key> anytime to toggle this panel
        </p>
      </div>
    </div>
  );
}
