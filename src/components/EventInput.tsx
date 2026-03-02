"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { List } from "@/lib/types";

interface EventInputProps {
  onAdd: (title: string, options?: { description?: string; list_id?: string | null; color?: string }) => void;
  lists?: List[];
}

export default function EventInput({ onAdd, lists = [] }: EventInputProps) {
  const [title, setTitle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  }

  return (
    <div className="glass-card p-4">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Create a new event... (e.g., Sprint Planning, Birthday Party)"
            className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
            aria-label="New event title"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-default disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Create event"
          >
            <Plus size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
