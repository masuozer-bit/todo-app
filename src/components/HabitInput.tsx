"use client";

import { useState, useRef } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { ScheduleType } from "@/lib/types";

interface HabitInputProps {
  onAdd: (
    title: string,
    scheduleType: ScheduleType,
    scheduleDays: number[]
  ) => void;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function HabitInput({ onAdd }: HabitInputProps) {
  const [title, setTitle] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [scheduleType, setScheduleType] = useState<ScheduleType>("daily");
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, scheduleType, scheduleType === "weekly" ? scheduleDays : []);
    setTitle("");
    setScheduleType("daily");
    setScheduleDays([1, 2, 3, 4, 5]);
    setShowOptions(false);
    inputRef.current?.focus();
  }

  function toggleDay(day: number) {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  return (
    <div className="glass-card p-4">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new habit..."
            className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
            aria-label="New habit title"
          />
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
            aria-label={
              showOptions ? "Hide schedule options" : "Show schedule options"
            }
          >
            {showOptions ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-default disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Add habit"
          >
            <Plus size={18} />
          </button>
        </div>

        {showOptions && (
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-3">
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1.5">
                Rhythm
              </p>
              <div className="flex gap-2">
                {(["daily", "weekly"] as ScheduleType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setScheduleType(type)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border capitalize transition-default ${
                      scheduleType === type
                        ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 font-medium text-black dark:text-white"
                        : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                    }`}
                  >
                    {type === "daily" ? "Every day" : "Specific days"}
                  </button>
                ))}
              </div>
            </div>

            {scheduleType === "weekly" && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1.5">
                  Days
                </p>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-default ${
                        scheduleDays.includes(i)
                          ? "bg-black dark:bg-white text-white dark:text-black"
                          : "border border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
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
