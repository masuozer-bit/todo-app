"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { List } from "@/lib/types";

interface EventInputProps {
  onAdd: (title: string, options?: { description?: string; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null; start_time?: string | null; end_time?: string | null }) => void;
  lists?: List[];
}

export default function EventInput({ onAdd, lists = [] }: EventInputProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, {
      due_date: dueDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
    });
    setTitle("");
    setDueDate("");
    setStartTime("");
    setEndTime("");
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
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-black dark:text-white focus:outline-none cursor-pointer flex-shrink-0"
            aria-label="Event date (optional)"
            title="Optional start date"
          />
          {dueDate && (
            <>
              <input
                type="time"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); if (!e.target.value) setEndTime(""); }}
                className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-black dark:text-white focus:outline-none cursor-pointer flex-shrink-0"
                aria-label="Start time (optional)"
                title="Optional start time"
              />
              {startTime && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  min={startTime}
                  className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-black dark:text-white focus:outline-none cursor-pointer flex-shrink-0"
                  aria-label="End time (optional)"
                  title="Optional end time"
                />
              )}
            </>
          )}
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
