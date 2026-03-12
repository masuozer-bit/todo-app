"use client";

import { useState, useRef } from "react";
import { Plus, ChevronDown, ChevronUp, Minus, Clock, FileText } from "lucide-react";
import type { ScheduleType } from "@/lib/types";

interface HabitInputProps {
  onAdd: (
    title: string,
    scheduleType: ScheduleType,
    scheduleDays: number[],
    scheduleInterval: number,
    time?: string | null,
    notes?: string | null,
    end_time?: string | null
  ) => void;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function HabitInput({ onAdd }: HabitInputProps) {
  const [title, setTitle] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [scheduleType, setScheduleType] = useState<ScheduleType>("interval");
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleInterval, setScheduleInterval] = useState(1);
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(
      trimmed,
      scheduleType,
      scheduleType === "weekly" ? scheduleDays : [],
      scheduleType === "interval" ? scheduleInterval : 1,
      time || null,
      notes.trim() || null,
      endTime || null
    );
    setTitle("");
    setScheduleType("interval");
    setScheduleDays([1, 2, 3, 4, 5]);
    setScheduleInterval(1);
    setTime("");
    setEndTime("");
    setNotes("");
    setShowOptions(false);
    inputRef.current?.focus();
  }

  function toggleDay(day: number) {
    setScheduleDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort()
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
            aria-label={showOptions ? "Hide options" : "Show options"}
          >
            {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-4">

            {/* Schedule rhythm */}
            <div>
              <p className="text-xs text-black/50 dark:text-gray-400 font-medium mb-1.5">Rhythm</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleType("interval")}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
                    scheduleType === "interval"
                      ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 font-medium text-black dark:text-white"
                      : "border-black/10 dark:border-white/10 text-black/50 dark:text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                  }`}
                >
                  Every X days
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType("weekly")}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
                    scheduleType === "weekly"
                      ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 font-medium text-black dark:text-white"
                      : "border-black/10 dark:border-white/10 text-black/50 dark:text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                  }`}
                >
                  Specific days
                </button>
              </div>
            </div>

            {scheduleType === "interval" && (
              <div>
                <p className="text-xs text-black/50 dark:text-gray-400 font-medium mb-1.5">Repeat every</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleInterval((p) => Math.max(1, p - 1))}
                    className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-default"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-black dark:text-white tabular-nums">
                    {scheduleInterval}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScheduleInterval((p) => Math.min(30, p + 1))}
                    className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-default"
                  >
                    <Plus size={14} />
                  </button>
                  <span className="text-xs text-black/50 dark:text-gray-400">
                    {scheduleInterval === 1 ? "day" : "days"}
                  </span>
                </div>
              </div>
            )}

            {scheduleType === "weekly" && (
              <div>
                <p className="text-xs text-black/50 dark:text-gray-400 font-medium mb-1.5">Days</p>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-default ${
                        scheduleDays.includes(i)
                          ? "bg-black dark:bg-white text-white dark:text-black"
                          : "border border-black/10 dark:border-white/10 text-black/50 dark:text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time */}
            <div>
              <p className="text-xs text-black/50 dark:text-gray-400 font-medium mb-1.5 flex items-center gap-1">
                <Clock size={11} /> Time <span className="font-normal opacity-60">(optional)</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => { setTime(e.target.value); if (!e.target.value) setEndTime(""); }}
                  className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                  aria-label="Habit start time"
                />
                {time && (
                  <span className="text-xs text-black/50 dark:text-gray-400">{formatTime12(time)}</span>
                )}
                {time && (
                  <>
                    <span className="text-xs text-black/30 dark:text-gray-600">→</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                      aria-label="Habit end time"
                    />
                    {endTime && (
                      <span className="text-xs text-black/50 dark:text-gray-400">{formatTime12(endTime)}</span>
                    )}
                  </>
                )}
                {time && (
                  <button
                    type="button"
                    onClick={() => { setTime(""); setEndTime(""); }}
                    className="text-xs text-black/30 dark:text-gray-600 hover:text-black dark:hover:text-white transition-default"
                    aria-label="Clear time"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-black/50 dark:text-gray-400 font-medium mb-1.5 flex items-center gap-1">
                <FileText size={11} /> Notes <span className="font-normal opacity-60">(optional)</span>
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes or context..."
                rows={2}
                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-gray-600 focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default resize-none"
                aria-label="Habit notes"
              />
            </div>

          </div>
        )}
      </form>
    </div>
  );
}
