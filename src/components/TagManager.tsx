"use client";

import { useState, useRef } from "react";
import { Plus, Tags } from "lucide-react";
import type { Tag } from "@/lib/types";
import TagPill from "./TagPill";

interface TagManagerProps {
  tags: Tag[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}

export default function TagManager({ tags, onAdd, onDelete }: TagManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [newTag, setNewTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewTag("");
      return;
    }
    onAdd(trimmed);
    setNewTag("");
    inputRef.current?.focus();
  }

  return (
    <div className="glass-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-black dark:text-white hover:opacity-70 transition-default w-full"
        aria-expanded={expanded}
      >
        <Tags size={16} />
        Manage Tags
        <span className="text-gray-400 text-xs ml-auto">
          {tags.length} {tags.length === 1 ? "tag" : "tags"}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="New tag name..."
              maxLength={30}
              className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-black/10 dark:border-white/10 text-sm text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-default"
              aria-label="New tag name"
            />
            <button
              type="submit"
              disabled={!newTag.trim()}
              className="w-8 h-8 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-default disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Add tag"
            >
              <Plus size={14} />
            </button>
          </form>

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <TagPill
                  key={tag.id}
                  name={tag.name}
                  onRemove={() => onDelete(tag.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">
              No tags yet. Create one above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
