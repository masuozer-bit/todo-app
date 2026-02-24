"use client";

import { useState, useRef } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import type { Tag } from "@/lib/types";

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
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
        aria-expanded={expanded}
      >
        <TagIcon size={12} />
        {expanded ? "Hide tags" : `Tags${tags.length > 0 ? ` (${tags.length})` : ""}`}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border border-black/8 dark:border-white/8 text-gray-500 dark:text-gray-400"
            >
              {tag.name}
              <button
                onClick={() => onDelete(tag.id)}
                className="text-gray-300 dark:text-gray-600 hover:text-black dark:hover:text-white transition-default"
                aria-label={`Remove tag ${tag.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Inline add */}
          <form onSubmit={handleAdd} className="inline-flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="+ add"
              maxLength={30}
              className="w-16 text-xs bg-transparent text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:w-24 transition-all duration-200"
              aria-label="New tag name"
            />
          </form>
        </div>
      )}
    </div>
  );
}
