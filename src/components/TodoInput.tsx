"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import type { Tag } from "@/lib/types";
import TagPill from "./TagPill";

interface TodoInputProps {
  onAdd: (title: string, tagIds: string[]) => void;
  tags: Tag[];
}

export default function TodoInput({ onAdd, tags }: TodoInputProps) {
  const [title, setTitle] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, selectedTagIds);
    setTitle("");
    setSelectedTagIds([]);
    setShowTags(false);
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
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => tags.length > 0 && setShowTags(true)}
          placeholder="Add a new task..."
          className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
          aria-label="New task title"
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-default disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          aria-label="Add task"
        >
          <Plus size={18} />
        </button>
      </form>

      {showTags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
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
      )}
    </div>
  );
}
