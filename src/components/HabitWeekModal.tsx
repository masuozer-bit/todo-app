"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { HabitWithStatus, HabitCompletion } from "@/lib/types";

interface HabitWeekModalProps {
  habit: HabitWithStatus;
  completions: HabitCompletion[];
  onClose: () => void;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

function isScheduledForDate(habit: HabitWithStatus, date: Date): boolean {
  if (habit.schedule_type === "weekly") {
    return habit.schedule_days.includes(date.getDay());
  }
  const interval = habit.schedule_interval || 1;
  if (interval === 1) return true;
  const start = new Date(habit.created_at);
  start.setHours(0, 0, 0, 0);
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  const diffMs = check.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays % interval === 0;
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function HabitWeekModal({ habit, completions, onClose }: HabitWeekModalProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));

  const completionDates = new Set(completions.map((c) => c.completed_date));

  // Build the 7 days of the week
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const weekEnd = days[6];
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(getWeekStart(today));

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function goToday() {
    setWeekStart(getWeekStart(today));
  }

  // Week label: "Mar 10 – 16" or "Feb 24 – Mar 2"
  const startLabel = `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`;
  const endLabel =
    weekEnd.getMonth() !== weekStart.getMonth()
      ? `${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}`
      : `${weekEnd.getDate()}`;
  const weekLabel = `${startLabel} – ${endLabel}, ${weekEnd.getFullYear()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card w-full max-w-md p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-black dark:text-white leading-snug">
              {habit.title}
            </h2>
            {(habit.time) && (
              <p className="text-xs text-black/40 dark:text-gray-500 mt-0.5">
                {formatTime12(habit.time)}{habit.end_time ? ` – ${formatTime12(habit.end_time)}` : ""}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevWeek}
            className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-default"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-black dark:text-white tabular-nums">
              {weekLabel}
            </span>
            {!isCurrentWeek && (
              <button
                onClick={goToday}
                className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default"
              >
                today
              </button>
            )}
          </div>
          <button
            onClick={nextWeek}
            className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20 transition-default"
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateStr = toDateStr(day);
            const isToday = dateStr === toDateStr(today);
            const scheduled = isScheduledForDate(habit, day);
            const completed = completionDates.has(dateStr);
            const isFuture = day > today;

            return (
              <div key={dateStr} className="flex flex-col items-center gap-1.5 py-2">
                {/* Day label */}
                <span className={`text-[10px] font-medium uppercase tracking-wider ${
                  isToday ? "text-black dark:text-white" : "text-black/40 dark:text-gray-500"
                }`}>
                  {DAY_SHORT[day.getDay()]}
                </span>

                {/* Date number + indicator */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center relative ${
                  isToday
                    ? "border-2 border-black dark:border-white"
                    : ""
                } ${
                  completed && scheduled
                    ? "bg-green-500/20 dark:bg-green-500/25"
                    : scheduled && !isFuture
                    ? "bg-black/5 dark:bg-white/5"
                    : ""
                }`}>
                  {completed && scheduled ? (
                    <Check size={14} className="text-green-500 dark:text-green-400" strokeWidth={2.5} />
                  ) : (
                    <span className={`text-xs font-medium tabular-nums ${
                      isToday
                        ? "text-black dark:text-white"
                        : scheduled
                        ? isFuture
                          ? "text-black/30 dark:text-gray-600"
                          : "text-black/70 dark:text-gray-300"
                        : "text-black/20 dark:text-gray-700"
                    }`}>
                      {day.getDate()}
                    </span>
                  )}
                </div>

                {/* Scheduled dot */}
                <div className={`w-1 h-1 rounded-full ${
                  scheduled
                    ? completed
                      ? "bg-green-500 dark:bg-green-400"
                      : isFuture
                      ? "bg-black/15 dark:bg-white/15"
                      : "bg-black/30 dark:bg-gray-500"
                    : "opacity-0"
                }`} />
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
          <span className="flex items-center gap-1.5 text-[10px] text-black/40 dark:text-gray-600">
            <Check size={10} className="text-green-500" strokeWidth={2.5} />
            Completed
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-black/40 dark:text-gray-600">
            <span className="w-3 h-3 rounded-md bg-black/10 dark:bg-white/10 inline-block" />
            Scheduled
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-black/40 dark:text-gray-600">
            <span className="w-3 h-3 rounded-md bg-transparent border border-black/10 dark:border-white/10 inline-block" />
            Not scheduled
          </span>
        </div>
      </div>
    </div>
  );
}
