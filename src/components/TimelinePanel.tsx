"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { Repeat, Maximize2 } from "lucide-react";
import type { Todo, HabitWithStatus, List, Event } from "@/lib/types";
import ScheduleWeekModal from "./ScheduleWeekModal";

interface TimelinePanelProps {
  todos: Todo[];
  habits: HabitWithStatus[];
  lists?: List[];
  events?: Event[];
  onTodoClick?: (todoId: string) => void;
  onHabitClick?: (habitId: string) => void;
  onUpdateTodo?: (id: string, updates: Record<string, unknown>) => void;
  weekModalOpen?: boolean;
  onToggleWeekModal?: () => void;
}

const HOUR_HEIGHT = 64;
const PAST_HOURS = 2;
const FUTURE_HOURS = 18;
const TOTAL_HOURS = PAST_HOURS + FUTURE_HOURS;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hr}${suffix}` : `${hr}:${String(m).padStart(2, "0")}${suffix}`;
}

function hourLabel(d: Date): string {
  const h = d.getHours();
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

export default function TimelinePanel({ todos, habits, lists, events, onTodoClick, onHabitClick, onUpdateTodo, weekModalOpen, onToggleWeekModal }: TimelinePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localModal, setLocalModal] = useState(false);
  const showWeekModal = weekModalOpen ?? localModal;
  const toggleWeekModal = onToggleWeekModal ?? (() => setLocalModal(v => !v));

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const windowStartMs = useMemo(() => now.getTime() - PAST_HOURS * 3_600_000, [now]);
  const windowEndMs = useMemo(() => now.getTime() + FUTURE_HOURS * 3_600_000, [now]);

  const today = toDateStr(now);
  const tomorrow = toDateStr(new Date(now.getTime() + 86_400_000));

  const totalPx = TOTAL_HOURS * HOUR_HEIGHT;
  const nowOffsetPx = ((now.getTime() - windowStartMs) / 3_600_000) * HOUR_HEIGHT;

  // Hour grid — only show even hours to reduce clutter
  const hourSlots = useMemo(() => {
    const slots: { date: Date; topPx: number }[] = [];
    const base = new Date(windowStartMs);
    base.setMinutes(0, 0, 0);
    for (let i = 0; i < TOTAL_HOURS + 2; i++) {
      const d = new Date(base.getTime() + i * 3_600_000);
      const top = ((d.getTime() - windowStartMs) / 3_600_000) * HOUR_HEIGHT;
      if (top >= -HOUR_HEIGHT && top <= totalPx + HOUR_HEIGHT) slots.push({ date: d, topPx: top });
    }
    return slots;
  }, [windowStartMs, totalPx]);

  // Timed todos
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
        const endMs = t.end_time
          ? dayBase.getTime() + parseTime(t.end_time) * 60_000
          : startMs + 30 * 60_000;

        if (startMs > windowEndMs || endMs < windowStartMs) return [];

        const topPx = ((startMs - windowStartMs) / 3_600_000) * HOUR_HEIGHT;
        const heightPx = Math.max(28, ((endMs - startMs) / 3_600_000) * HOUR_HEIGHT);
        const isPast = endMs < now.getTime();
        return [{ todo: t, topPx, heightPx, startMs, isPast }];
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [todos, today, tomorrow, now, windowStartMs, windowEndMs]);

  // Timed habits
  const timedHabits = useMemo(() => {
    return habits
      .filter(h => !!h.time)
      .flatMap(h => {
        const base = new Date(now); base.setHours(0, 0, 0, 0);
        const startMs = base.getTime() + parseTime(h.time!) * 60_000;
        const endMs = h.end_time
          ? base.getTime() + parseTime(h.end_time) * 60_000
          : startMs + 30 * 60_000;
        if (startMs > windowEndMs || endMs < windowStartMs) return [];
        const topPx = ((startMs - windowStartMs) / 3_600_000) * HOUR_HEIGHT;
        const heightPx = Math.max(28, ((endMs - startMs) / 3_600_000) * HOUR_HEIGHT);
        const isPast = endMs < now.getTime();
        return [{ habit: h, topPx, heightPx, startMs, isPast }];
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [habits, now, windowStartMs, windowEndMs]);

  // Auto-scroll to now or next item
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const allItems = [
      ...timedTodos.map(t => ({ topPx: t.topPx, startMs: t.startMs })),
      ...timedHabits.map(h => ({ topPx: h.topPx, startMs: h.startMs })),
    ];
    const next = allItems.filter(i => i.startMs >= now.getTime()).sort((a, b) => a.startMs - b.startMs)[0];
    // Position: show now-line near top with some breathing room
    el.scrollTop = (next ? Math.min(next.topPx, nowOffsetPx) : nowOffsetPx) - 40;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTimeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="glass-card overflow-hidden flex flex-col" style={{ height: 420 }}>
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.05]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-black/50 dark:text-gray-400">Schedule</span>
        <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.05]" />
        <span className="text-[10px] text-black/30 dark:text-gray-600 tabular-nums">{currentTimeLabel}</span>
        <button
          onClick={toggleWeekModal}
          className="text-black/25 dark:text-gray-700 hover:text-black dark:hover:text-white transition-default"
          aria-label="Open week view"
          title="Week view"
        >
          <Maximize2 size={11} />
        </button>
      </div>

      {/* Timeline */}
      <div ref={containerRef} className="overflow-y-auto scroll-smooth flex-1 min-h-0">
        <div className="relative select-none" style={{ height: totalPx }}>

          {/* Hour grid lines */}
          {hourSlots.map(({ date, topPx }) => {
            const isPast = date.getTime() < now.getTime();
            const isMidnight = date.getHours() === 0;
            return (
              <div
                key={date.toISOString()}
                className="absolute left-0 right-0 flex items-start pointer-events-none"
                style={{ top: topPx }}
              >
                <div className="w-10 flex-shrink-0 flex items-start justify-end pr-2 -translate-y-2">
                  <span className={`text-[10px] tabular-nums leading-none ${
                    isPast
                      ? "text-black/15 dark:text-white/10"
                      : isMidnight
                        ? "text-black/50 dark:text-gray-300 font-semibold"
                        : "text-black/30 dark:text-gray-600"
                  }`}>
                    {isMidnight ? date.toLocaleDateString([], { weekday: "short" }) : hourLabel(date)}
                  </span>
                </div>
                <div className={`flex-1 ${
                  isMidnight
                    ? "h-px bg-black/10 dark:bg-white/10"
                    : isPast
                      ? "h-px bg-black/[0.03] dark:bg-white/[0.03]"
                      : "h-px bg-black/[0.05] dark:bg-white/[0.05]"
                }`} />
              </div>
            );
          })}

          {/* Now line */}
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-30"
            style={{ top: nowOffsetPx }}
          >
            <div className="w-10 flex-shrink-0 flex justify-end pr-1.5">
              <div className="w-[7px] h-[7px] rounded-full bg-red-500" />
            </div>
            <div className="flex-1 h-[1px] bg-red-500/60" />
          </div>

          {/* Todo blocks */}
          {timedTodos.map(({ todo, topPx, heightPx, isPast }) => {
            const list = todo.list_id ? lists?.find(l => l.id === todo.list_id) : null;
            const listColor = list?.color;
            return (
              <div
                key={todo.id}
                onClick={() => onTodoClick?.(todo.id)}
                className={`absolute left-11 right-2 rounded-lg overflow-hidden z-10 transition-all ${
                  isPast ? "opacity-30" : ""
                } ${onTodoClick ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]" : ""}`}
                style={{
                  top: topPx + 1,
                  height: Math.max(26, heightPx - 2),
                  background: "rgba(0,0,0,0.65)",
                  borderBottom: listColor ? `3px solid ${listColor}` : undefined,
                }}
              >
                <div className="px-2 py-1 h-full flex flex-col justify-center">
                  <span className="text-[11px] font-medium text-white truncate leading-tight">{todo.title}</span>
                  {heightPx > 36 && (
                    <span className="text-[9px] text-white/50 mt-0.5">
                      {fmtTime(todo.start_time!)}{todo.end_time ? ` – ${fmtTime(todo.end_time)}` : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Habit blocks */}
          {timedHabits.map(({ habit, topPx, heightPx, isPast }) => (
            <div
              key={habit.id}
              onClick={() => onHabitClick?.(habit.id)}
              className={`absolute left-11 right-2 rounded-lg overflow-hidden z-10 transition-all ${
                isPast || habit.completedToday ? "opacity-30" : ""
              } ${onHabitClick ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]" : ""}`}
              style={{
                top: topPx + 1,
                height: Math.max(26, heightPx - 2),
                background: "rgba(100,60,180,0.7)",
              }}
            >
              <div className="px-2 py-1 h-full flex flex-col justify-center">
                <span className={`text-[11px] font-medium text-white truncate leading-tight flex items-center gap-1.5 ${habit.completedToday ? "line-through" : ""}`}>
                  <Repeat size={9} className="flex-shrink-0 opacity-60" />
                  {habit.title}
                </span>
                {heightPx > 36 && (
                  <span className="text-[9px] text-white/50 mt-0.5 pl-[18px]">
                    {fmtTime(habit.time!)}{habit.end_time ? ` – ${fmtTime(habit.end_time)}` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}
