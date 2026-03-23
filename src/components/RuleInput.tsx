"use client";

import { useState, useRef } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { List } from "@/lib/types";

interface RuleInputProps {
  onAdd: (title: string, description?: string, category?: string) => void;
  lists: List[];
  compact?: boolean;
}

export default function RuleInput({ onAdd, lists, compact }: RuleInputProps) {
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
    <div className={compact ? "py-1" : "glass-card p-4"}>
      <form onSubmit={handleSubmit}>
        <div className={`flex items-center ${compact ? "gap-1.5" : "gap-3"}`}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a rule..."
            className={`flex-1 bg-transparent outline-none text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ${compact ? "text-[11px]" : "text-sm"}`}
          />
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
          >
            {showOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white disabled:opacity-30 transition-default"
          >
            <Plus size={16} />
          </button>
        </div>

        {showOptions && (
          <div className="mt-3 space-y-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why this rule matters..."
              rows={2}
              className="w-full bg-transparent outline-none text-xs text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-black/40 dark:text-gray-500 uppercase tracking-wider font-medium">List:</span>
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setCategory(category === l.name ? "" : l.name)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-default border ${
                    category === l.name
                      ? "bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-black dark:text-white"
                      : "border-transparent text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white"
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
