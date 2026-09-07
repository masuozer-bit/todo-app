"use client";

import { useState } from "react";
import { useI18n } from "./I18nProvider";
import { Plus } from "lucide-react";
import type { List } from "@/lib/types";
import { DatePicker, TimePicker } from "./Pickers";

interface EventInputProps {
  onAdd: (title: string, options?: { description?: string; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null; start_time?: string | null; end_time?: string | null }) => void;
  lists?: List[];
}

export default function EventInput({ onAdd, lists = [] }: EventInputProps) {
  const { t } = useI18n();
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
            placeholder={t("New project... (e.g. Sprint planning, Kitchen renovation)")}
            className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
            aria-label={t("New project title")}
          />
          <DatePicker value={dueDate} onChange={setDueDate} placeholder={t("Date")} />
          {dueDate && (
            <>
              <TimePicker
                value={startTime}
                onChange={(v) => { setStartTime(v); if (!v) setEndTime(""); }}
                placeholder={t("Time")}
              />
              {startTime && (
                <TimePicker value={endTime} onChange={setEndTime} placeholder={t("End")} />
              )}
            </>
          )}
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-default disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            aria-label={t("Create project")}
          >
            <Plus size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
