"use client";

import { useState, useRef } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { Tag, Priority, List } from "@/lib/types";
import TagPill from "./TagPill";

interface TodoInputProps {
  onAdd: (
    title: string,
    tagIds: string[],
    options?: {
      due_date?: string | null;
      priority?: Priority;
      notes?: string | null;
      list_id?: string | null;
    }
  ) => void;
  tags: Tag[];
  lists?: List[];
  activeListId?: string | null;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "none", label: "No priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function TodoInput({
  onAdd,
  tags,
  lists = [],
  activeListId,
}: TodoInputProps) {
  const [title, setTitle] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [notes, setNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, selectedTagIds, {
      due_date: dueDate || null,
      priority,
      notes: notes.trim() || null,
      list_id: activeListId ?? null,
    });
    setTitle("");
    setSelectedTagIds([]);
    setDueDate("");
    setPriority("none");
    setNotes("");
    setShowOptions(false);
    inputRef.current?.focus();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  return (
    <div className="glass-card p-4">
      <form onSubmit={handleSubmit}>
        {/* Title row */}
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
            aria-label="New task title"
          />

          {/* Toggle options */}
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
            aria-label={showOptions ? "Hide options" : "Show options"}
          >
            {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-default disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Add task"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Expanded options */}
        {showOptions && (
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-3">
            {/* Priority + Due date row */}
            <div className="flex flex-wrap gap-3">
              {/* Priority */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-medium">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="text-xs bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default cursor-pointer"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-medium">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 font-medium">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note..."
                rows={2}
                className="w-full text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/30 dark:focus:border-white/30 resize-none transition-default"
              />
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1.5">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <TagPill
                      key={tag.id}
                      name={tag.name}
                      selected={selectedTagIds.includes(tag.id)}
                      onClick={() => toggleTag(tag.id)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
