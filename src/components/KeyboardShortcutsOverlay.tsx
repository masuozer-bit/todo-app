"use client";

import { useEffect } from "react";
import { useI18n } from "./I18nProvider";
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
      { keys: [["C"]], description: "Toggle calendar panel" },
      { keys: [["S"]], description: "Open week planner" },
      { keys: [["M"]], description: "Filter and sort" },
      { keys: [["T"]], description: "Templates" },
      { keys: [["R"]], description: "New rule" },
      { keys: [["B"]], description: "Show or hide the task input" },
      { keys: [["?"]], description: "Shortcuts" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { keys: [["Enter"]], description: "Save / confirm" },
      { keys: [["Esc"]], description: "Cancel / close" },
      { keys: [["⌘", "⇧", "L"]], description: "Dark / light mode" },
    ],
  },
  {
    label: "Task Input",
    shortcuts: [
      { keys: [["today"], ["tomorrow"]], description: "Set due date" },
      { keys: [["at 3pm"], ["9:30am"]], description: "Set time" },
      { keys: [["!high"], ["!med"], ["!low"]], description: "Priority" },
      { keys: [["#tag"]], description: "Add a tag (creates it if new)" },
      { keys: [["@List"]], description: "Assign a list" },
      { keys: [["@Project"]], description: "Assign a project" },
    ],
  },
];

function Key({ children }: { children: string }) {
  const isWord = children.length > 3;
  return (
    <kbd
      className={`inline-flex items-center justify-center h-6 text-xs font-medium rounded-md surface-2 border border-border text-text ${
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
  const { t } = useI18n();
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

      <div className="relative dialog p-5 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text">{t("Keyboard Shortcuts")}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-default"
            aria-label={t("Close")}
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-text-faint">
                      {s.description}
                    </span>
                    <div className="flex items-center gap-2">
                      {s.keys.map((combo, ci) => (
                        <span key={ci} className="flex items-center gap-0.5">
                          {ci > 0 && (
                            <span className="text-xs text-gray-600 mx-1">
                              /
                            </span>
                          )}
                          {combo.map((k, ki) => (
                            <span key={ki} className="flex items-center gap-0.5">
                              {ki > 0 && (
                                <span className="text-xs text-gray-600">
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

        <p className="text-xs text-gray-600 mt-4 text-center">
          Press <Key>?</Key> to toggle
        </p>
      </div>
    </div>
  );
}
