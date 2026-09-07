"use client";

import { useState, useRef } from "react";
import { useI18n } from "./I18nProvider";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { List } from "@/lib/types";

interface RuleInputProps {
  onAdd: (title: string, description?: string, category?: string) => void;
  lists: List[];
  compact?: boolean;
}

export default function RuleInput({ onAdd, lists, compact }: RuleInputProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, description.trim() || undefined, category || undefined);
    setTitle("");
    setDescription("");
    setCategory("");
    setShowOptions(false);
    inputRef.current?.focus();
  }

  return (
    <div className={compact ? "py-1" : "surface border border-border rounded-lg p-4"}>
      <form onSubmit={handleSubmit}>
        <div className={`flex items-center ${compact ? "gap-1.5" : "gap-3"}`}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("Add a principle...")}
            className={`flex-1 bg-transparent outline-none text-text placeholder:text-text-faint dark:placeholder:text-text-muted ${compact ? "text-xs" : "text-sm"}`}
          />
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-text-faint dark:text-text-muted hover:text-text transition-default"
          >
            {showOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="text-text-faint dark:text-text-muted hover:text-text disabled:opacity-30 transition-default"
          >
            <Plus size={16} />
          </button>
        </div>

        {showOptions && (
          <div className="mt-3 space-y-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("Why this principle matters...")}
              rows={2}
              className="w-full bg-transparent outline-none text-xs text-text placeholder:text-text-faint dark:placeholder:text-text-muted resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-faint uppercase tracking-wider font-medium">List:</span>
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setCategory(category === l.name ? "" : l.name)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-default border ${
                    category === l.name
                      ? "surface-3 border-border-strong text-text"
                      : "border-transparent text-text-faint hover:text-text"
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
