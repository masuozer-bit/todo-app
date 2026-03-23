"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string[][]; description: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    label: "Navigation",
    shortcuts: [
      { keys: [["N"]], description: "New task" },
      { keys: [["/"], ["⌘", "K"]], description: "Search" },
      { keys: [["C"]], description: "Toggle calendar & schedule" },
      { keys: [["S"]], description: "Open week planner" },
      { keys: [["R"]], description: "New rule" },
      { keys: [["?"]], description: "Shortcuts" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { keys: [["Enter"]], description: "Save / confirm" },
      { keys: [["Esc"]], description: "Cancel / close" },
      { keys: [["⌘", "D"]], description: "Dark / light mode" },
    ],
  },
  {
    label: "Task Input",
    shortcuts: [
      { keys: [["today"], ["tomorrow"]], description: "Set due date" },
      { keys: [["at 3pm"], ["9:30am"]], description: "Set time" },
      { keys: [["!high"], ["!med"], ["!low"]], description: "Priority" },
      { keys: [["#List"]], description: "Assign list" },
      { keys: [["@Event"]], description: "Assign event" },
    ],
  },
];

function Key({ children }: { children: string }) {
  const isWord = children.length > 3;
  return (
    <kbd
      className={`inline-flex items-center justify-center h-6 text-[11px] font-medium rounded-md bg-white/[0.08] border border-white/[0.12] text-white/80 ${
        isWord ? "px-2 font-mono" : "min-w-[1.5rem] px-1.5"
      }`}
    >
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative glass-card-raised p-5 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-default"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-gray-400">
                      {s.description}
                    </span>
                    <div className="flex items-center gap-2">
                      {s.keys.map((combo, ci) => (
                        <span key={ci} className="flex items-center gap-0.5">
                          {ci > 0 && (
                            <span className="text-[10px] text-gray-600 mx-1">
                              /
                            </span>
                          )}
                          {combo.map((k, ki) => (
                            <span key={ki} className="flex items-center gap-0.5">
                              {ki > 0 && (
                                <span className="text-[10px] text-gray-600">
                                  +
                                </span>
                              )}
                              <Key>{k}</Key>
                            </span>
                          ))}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-600 mt-4 text-center">
          Press <Key>?</Key> to toggle
        </p>
      </div>
    </div>
  );
}
