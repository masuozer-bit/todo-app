"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { Repeat, Maximize2 } from "lucide-react";
import type { Todo, HabitWithStatus } from "@/lib/types";
import ScheduleWeekModal from "./ScheduleWeekModal";

interface TimelinePanelProps {
  todos: Todo[];
  habits: HabitWithStatus[];
  onTodoClick?: (todoId: string) => void;
  onHabitClick?: (habitId: string) => void;
}

const HOUR_HEIGHT = 56; // px per hour
const PAST_HOURS = 6;
const FUTURE_HOURS = 24;
const TOTAL_HOURS = PAST_HOURS + FUTURE_HOURS; // 30h window

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTime(t: string): number {
  // returns minutes since midnight
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function hourLabel(d: Date): string {
  const h = d.getHours();
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

function priorityClass(p?: string): string {
  if (p === "high")   return "bg-red-500   border-red-600/40";
  if (p === "medium") return "bg-orange-400 border-orange-500/40";
  if (p === "low")    return "bg-sky-500    border-sky-600/40";
  return "bg-zinc-600 border-zinc-700/40 dark:bg-zinc-400 dark:border-zinc-300/40";
}

export default function TimelinePanel({ todos, habits, onTodoClick, onHabitClick }: TimelinePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showWeekModal, setShowWeekModal] = useState(false);

  // Live clock — updates every minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const windowStartMs = useMemo(() => now.getTime() - PAST_HOURS * 3_600_000, [now]);
  const windowEndMs   = useMemo(() => now.getTime() + FUTURE_HOURS * 3_600_000, [now]);

  const today    = toDateStr(now);
  const tomorrow = toDateStr(new Date(now.getTime() + 86_400_000));

  const totalPx     = TOTAL_HOURS * HOUR_HEIGHT;
  const nowOffsetPx = ((now.getTime() - windowStartMs) / 3_600_000) * HOUR_HEIGHT;

  // ── Hour-grid lines ────────────────────────────────────────────────────────
  const hourSlots = useMemo(() => {
    const slots: { date: Date; topPx: number }[] = [];
    // Floor window start to nearest hour
    const base = new Date(windowStartMs);
    base.setMinutes(0, 0, 0);
    for (let i = 0; i < TOTAL_HOURS + 2; i++) {
      const d = new Date(base.getTime() + i * 3_600_000);
      const top = ((d.getTime() - windowStartMs) / 3_600_000) * HOUR_HEIGHT;
      if (top >= -HOUR_HEIGHT && top <= totalPx + HOUR_HEIGHT) slots.push({ date: d, topPx: top });
    }
    return slots;
  }, [windowStartMs, totalPx]);

  // ── Timed todos ────────────────────────────────────────────────────────────
  const timedTodos = useMemo(() => {
    return todos
      .filter(t => !t.completed && !!t.start_time)
      .flatMap(t => {
        const dueDate = t.due_date ?? t.start_date;
        if (!dueDate) return [];

        let dayBase: Date;
        if (dueDate === today) {
          dayBase = new Date(now); dayBase.setHours(0, 0, 0, 0);
        } else if (dueDate === tomorrow) {
          dayBase = new Date(now); dayBase.setDate(dayBase.getDate() + 1); dayBase.setHours(0, 0, 0, 0);
        } else {
          return [];
        }

        const startMs = dayBase.getTime() + parseTime(t.start_time!) * 60_000;
        const endMs   = t.end_time
          ? dayBase.getTime() + parseTime(t.end_time) * 60_000
          : startMs + 30 * 60_000; // default 30 min

        if (startMs > windowEndMs || endMs < windowStartMs) return [];

        const topPx    = ((startMs - windowStartMs) / 3_600_000) * HOUR_HEIGHT;
        const heightPx = Math.max(20, ((endMs - startMs) / 3_600_000) * HOUR_HEIGHT);
        return [{ todo: t, topPx, heightPx, startMs }];
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [todos, today, tomorrow, now, windowStartMs, windowEndMs]);

  // ── Timed habits ───────────────────────────────────────────────────────────
  const timedHabits = useMemo(() => {
    return habits
      .filter(h => !!h.time)
      .flatMap(h => {
        const base = new Date(now); base.setHours(0, 0, 0, 0);
        const startMs = base.getTime() + parseTime(h.time!) * 60_000;
        const endMs   = h.end_time
          ? base.getTime() + parseTime(h.end_time) * 60_000
          : startMs + 30 * 60_000; // default 30 min
        if (startMs > windowEndMs || endMs < windowStartMs) return [];
        const topPx    = ((startMs - windowStartMs) / 3_600_000) * HOUR_HEIGHT;
        const heightPx = Math.max(18, ((endMs - startMs) / 3_600_000) * HOUR_HEIGHT);
        return [{ habit: h, topPx, heightPx, startMs }];
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [habits, now, windowStartMs, windowEndMs]);

  // Auto-scroll: center on next upcoming item, or fall back to current time
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nowMs = now.getTime();
    const allItems = [
      ...timedTodos.map(t => ({ topPx: t.topPx, heightPx: t.heightPx, startMs: t.startMs })),
      ...timedHabits.map(h => ({ topPx: h.topPx, heightPx: h.heightPx, startMs: h.startMs })),
    ];
    const next = allItems.filter(i => i.startMs >= nowMs).sort((a, b) => a.startMs - b.startMs)[0];
    if (next) {
      // Center the next item in the visible area
      el.scrollTop = next.topPx - el.clientHeight / 2 + next.heightPx / 2;
    } else {
      el.scrollTop = nowOffsetPx - HOUR_HEIGHT * 1.5;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTimeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="glass-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.05]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-gray-400">Schedule</span>
        <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.05]" />
        <span className="text-[10px] text-black/30 dark:text-gray-600 tabular-nums">{currentTimeLabel}</span>
        <button
          onClick={() => setShowWeekModal(true)}
          className="text-black/25 dark:text-gray-700 hover:text-black dark:hover:text-white transition-default"
          aria-label="Open week view"
          title="Week view"
        >
          <Maximize2 size={11} />
        </button>
      </div>

      {/* Scrollable timeline */}
      <div ref={containerRef} className="overflow-y-auto scroll-smooth flex-1 min-h-0">
        <div className="relative select-none" style={{ height: totalPx }}>

          {/* Hour grid lines + labels */}
          {hourSlots.map(({ date, topPx }) => {
            const isPast = date.getTime() < now.getTime();
            const isMidnight = date.getHours() === 0;
            return (
              <div
                key={date.toISOString()}
                className="absolute left-0 right-0 flex items-start pointer-events-none"
                style={{ top: topPx }}
              >
                {/* Label */}
                <div className="w-9 flex-shrink-0 flex items-start justify-end pr-1.5 -translate-y-2">
                  <span className={`text-[9px] tabular-nums leading-none ${
                    isPast
                      ? "text-black/20 dark:text-white/15"
                      : isMidnight
                        ? "text-black/60 dark:text-gray-300 font-semibold"
                        : "text-black/35 dark:text-gray-500"
                  }`}>
                    {isMidnight ? date.toLocaleDateString([], { weekday: "short" }) : hourLabel(date)}
                  </span>
                </div>
                {/* Grid line */}
                <div className={`flex-1 ${
                  isMidnight
                    ? "h-px bg-black/12 dark:bg-white/12"
                    : isPast
                      ? "h-px bg-black/[0.04] dark:bg-white/[0.04]"
                      : "h-px bg-black/[0.07] dark:bg-white/[0.07]"
                }`} />
              </div>
            );
          })}

          {/* ── Current-time red line ── */}
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-30"
            style={{ top: nowOffsetPx }}
          >
            <div className="w-9 flex-shrink-0 flex justify-end pr-1">
              <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-400/30 flex-shrink-0" />
            </div>
            <div className="flex-1 h-[1.5px] bg-red-500/75" />
          </div>

          {/* ── Todo blocks ── */}
          {timedTodos.map(({ todo, topPx, heightPx }) => (
            <div
              key={todo.id}
              onClick={() => onTodoClick?.(todo.id)}
              className={`absolute left-10 right-1.5 rounded-[5px] px-1.5 py-0.5 border text-white text-[9px] font-semibold overflow-hidden z-10 ${priorityClass(todo.priority)} ${onTodoClick ? "cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all" : ""}`}
              style={{ top: topPx + 1, height: Math.max(18, heightPx - 2) }}
              title={`${todo.title}  ${todo.start_time}${todo.end_time ? `–${todo.end_time}` : ""}`}
            >
              <span className="truncate block leading-tight">{todo.title}</span>
              {heightPx > 34 && (
                <span className="opacity-60 text-[8px] block">
                  {todo.start_time}{todo.end_time ? `–${todo.end_time}` : ""}
                </span>
              )}
            </div>
          ))}

          {/* ── Habit blocks ── */}
          {timedHabits.map(({ habit, topPx, heightPx }) => (
            <div
              key={habit.id}
              onClick={() => onHabitClick?.(habit.id)}
              className={`absolute left-10 right-1.5 rounded-[5px] px-1.5 py-0.5 border text-white text-[9px] font-semibold overflow-hidden z-10 bg-violet-500 border-violet-600/40 ${habit.completedToday ? "opacity-35" : ""} ${onHabitClick ? "cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all" : ""}`}
              style={{ top: topPx + 1, height: Math.max(18, heightPx - 2) }}
              title={`${habit.title}  ${habit.time}${habit.end_time ? `–${habit.end_time}` : ""}`}
            >
              <span className={`flex items-center gap-1 leading-tight ${habit.completedToday ? "line-through" : ""}`}>
                <Repeat size={7} className="flex-shrink-0 opacity-80 shrink-0" />
                <span className="truncate">{habit.title}</span>
              </span>
              {heightPx > 34 && (
                <span className="opacity-60 text-[8px] block">
                  {habit.time}{habit.end_time ? `–${habit.end_time}` : ""}
                </span>
              )}
            </div>
          ))}

        </div>
      </div>

      {showWeekModal && (
        <ScheduleWeekModal
          todos={todos}
          habits={habits}
          onTodoClick={onTodoClick}
          onHabitClick={onHabitClick}
          onClose={() => setShowWeekModal(false)}
        />
      )}
    </div>
  );
}
