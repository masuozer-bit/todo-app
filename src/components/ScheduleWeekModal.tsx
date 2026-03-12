"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import type { Todo, HabitWithStatus } from "@/lib/types";

interface ScheduleWeekModalProps {
  todos: Todo[];
  habits: HabitWithStatus[];
  onTodoClick?: (id: string) => void;
  onHabitClick?: (id: string) => void;
  onClose: () => void;
}

// Full 24h view
const VIEW_START_HOUR = 0;
const VIEW_END_HOUR   = 24;
const VISIBLE_HOURS   = VIEW_END_HOUR - VIEW_START_HOUR; // 24
const HOUR_PX         = 64;
const TOTAL_PX        = VISIBLE_HOURS * HOUR_PX;

// Left sidebar = w-48 = 12rem = 192px; small gutter = 8px
const SIDEBAR_OFFSET  = "calc(12rem + 8px)";

const DAY_SHORT   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function hourLabel(h: number): string {
  if (h === 0)  return "12am";
  if (h === 12) return "12pm";
  if (h === 24) return "";
  return h > 12 ? `${h-12}pm` : `${h}am`;
}

// Monday-based week start
function getWeekStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0,0,0,0);
  const day = out.getDay(); // 0=Sun … 6=Sat
  const daysFromMonday = day === 0 ? 6 : day - 1;
  out.setDate(out.getDate() - daysFromMonday);
  return out;
}

function isScheduledForDate(habit: HabitWithStatus, date: Date): boolean {
  if (habit.schedule_type === "weekly") return habit.schedule_days.includes(date.getDay());
  const interval = habit.schedule_interval || 1;
  if (interval === 1) return true;
  const start = new Date(habit.created_at);
  start.setHours(0,0,0,0);
  const check = new Date(date);
  check.setHours(0,0,0,0);
  const diffDays = Math.round((check.getTime() - start.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays % interval === 0;
}

function priorityBg(p?: string): string {
  if (p === "high")   return "bg-red-500 border-red-600/40";
  if (p === "medium") return "bg-orange-400 border-orange-500/40";
  if (p === "low")    return "bg-sky-500 border-sky-600/40";
  return "bg-zinc-600 border-zinc-500/40 dark:bg-zinc-400 dark:border-zinc-300/40";
}

export default function ScheduleWeekModal({
  todos, habits, onTodoClick, onHabitClick, onClose,
}: ScheduleWeekModalProps) {
  const now      = useMemo(() => new Date(), []);
  const today    = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d; }, [now]);
  const todayStr = toDateStr(today);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to 1.5h before current time on open
  useEffect(() => {
    if (scrollRef.current) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const target = (nowMin / 60) * HOUR_PX - HOUR_PX * 1.5;
      scrollRef.current.scrollTop = Math.max(0, target);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mon → Sun: 7 days
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
  [weekStart]);

  const weekEnd        = days[6];
  const isCurrentWeek  = toDateStr(weekStart) === toDateStr(getWeekStart(today));

  const startLabel = `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
  const endLabel   = weekEnd.getMonth() !== weekStart.getMonth()
    ? `${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}`
    : `${weekEnd.getDate()}`;
  const weekLabel  = `${startLabel} – ${endLabel}, ${weekEnd.getFullYear()}`;

  // Current-time position within the 24h grid
  const nowTopPx = useMemo(() => {
    const min = now.getHours() * 60 + now.getMinutes();
    return (min / 60) * HOUR_PX;
  }, [now]);

  // Hour slots 0 … 24
  const hourSlots = useMemo(() =>
    Array.from({ length: VISIBLE_HOURS + 1 }, (_, i) => i),
  []);

  // Per-day item blocks
  const dayColumns = useMemo(() => {
    return days.map(day => {
      const dayStr = toDateStr(day);
      type ItemBlock = {
        key: string; type: "todo" | "habit";
        id: string; title: string;
        topPx: number; heightPx: number;
        extra: string; priority?: string; completed: boolean;
      };
      const items: ItemBlock[] = [];

      todos
        .filter(t => !t.completed && !!t.start_time && (t.due_date === dayStr || t.start_date === dayStr))
        .forEach(t => {
          const startMin = parseTime(t.start_time!);
          const endMin   = t.end_time ? parseTime(t.end_time) : startMin + 30;
          const topPx    = (startMin / 60) * HOUR_PX;
          const heightPx = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX);
          if (topPx > TOTAL_PX || topPx + heightPx < 0) return;
          items.push({ key: t.id, type: "todo", id: t.id, title: t.title, topPx, heightPx, extra: `${t.start_time}${t.end_time ? `–${t.end_time}` : ""}`, priority: t.priority ?? undefined, completed: false });
        });

      habits
        .filter(h => !!h.time && isScheduledForDate(h, day))
        .forEach(h => {
          const startMin = parseTime(h.time!);
          const endMin   = h.end_time ? parseTime(h.end_time) : startMin + 30;
          const topPx    = (startMin / 60) * HOUR_PX;
          const heightPx = Math.max(18, ((endMin - startMin) / 60) * HOUR_PX);
          if (topPx > TOTAL_PX || topPx + heightPx < 0) return;
          items.push({ key: h.id, type: "habit", id: h.id, title: h.title, topPx, heightPx, extra: `${h.time}${h.end_time ? `–${h.end_time}` : ""}`, completed: h.completedToday });
        });

      return { day, dayStr, isToday: dayStr === todayStr, items };
    });
  }, [days, todos, habits, todayStr]);

  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
  }

  const modal = (
    /* Backdrop — covers full screen with blur */
    <div
      className="fixed inset-0 z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
    >
      {/* Glass card — starts after left sidebar, fills rest of screen */}
      <div
        className="glass-card absolute flex flex-col overflow-hidden"
        style={{ left: SIDEBAR_OFFSET, right: 8, top: 8, bottom: 8 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.07] dark:border-white/[0.06] flex-shrink-0">
          <button
            onClick={prevWeek}
            className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-2 flex-1 justify-center">
            <span className="text-sm font-semibold text-black dark:text-white tabular-nums">
              {weekLabel}
            </span>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekStart(getWeekStart(today))}
                className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default"
              >
                today
              </button>
            )}
          </div>

          <button
            onClick={nextWeek}
            className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default"
          >
            <ChevronRight size={14} />
          </button>

          <div className="w-px h-4 bg-black/10 dark:bg-white/10" />

          <button
            onClick={onClose}
            className="text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Day headers (Mon … Sun) ──────────────────────────────────── */}
        <div
          className="flex border-b border-black/[0.07] dark:border-white/[0.06] flex-shrink-0"
          style={{ paddingLeft: 44 }}
        >
          {dayColumns.map(({ day, isToday }) => (
            <div
              key={toDateStr(day)}
              className="flex-1 flex flex-col items-center py-2 gap-0.5"
            >
              <span className={`text-[10px] uppercase tracking-wider font-medium ${isToday ? "text-black dark:text-white" : "text-black/40 dark:text-gray-500"}`}>
                {DAY_SHORT[day.getDay()]}
              </span>
              <span className={`text-sm font-bold tabular-nums leading-none ${
                isToday
                  ? "w-4/5 py-1 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center"
                  : "text-black/70 dark:text-gray-300"
              }`}>
                {day.getDate()}
              </span>
            </div>
          ))}
        </div>

        {/* ── Scrollable 24h grid ──────────────────────────────────────── */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0">
          <div className="flex" style={{ height: TOTAL_PX }}>

            {/* Time labels */}
            <div className="flex-shrink-0 relative" style={{ width: 44 }}>
              {hourSlots.map(h => h < 24 && (
                <div
                  key={h}
                  className="absolute right-0 pr-2"
                  style={{ top: h * HOUR_PX - 7 }}
                >
                  <span className="text-[9px] text-black/30 dark:text-gray-600 tabular-nums leading-none">
                    {hourLabel(h)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {dayColumns.map(({ day, dayStr, isToday, items }) => (
              <div
                key={dayStr}
                className={`flex-1 relative border-l border-black/[0.05] dark:border-white/[0.05] ${isToday ? "bg-black/[0.015] dark:bg-white/[0.015]" : ""}`}
                style={{ height: TOTAL_PX }}
              >
                {/* Hour grid lines */}
                {hourSlots.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: h * HOUR_PX, height: 1, backgroundColor: h % 6 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}
                  />
                ))}

                {/* Half-hour lines */}
                {hourSlots.map(h => h < 24 && (
                  <div
                    key={`h${h}.5`}
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: h * HOUR_PX + HOUR_PX / 2, height: 1, backgroundColor: "rgba(0,0,0,0.025)" }}
                  />
                ))}

                {/* Current-time red line (today only) */}
                {isToday && nowTopPx >= 0 && nowTopPx <= TOTAL_PX && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: nowTopPx, height: 1.5, backgroundColor: "rgb(239,68,68)" }}
                  >
                    <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
                  </div>
                )}

                {/* Items */}
                {items.map(item => (
                  item.type === "todo" ? (
                    <div
                      key={item.key}
                      onClick={() => { onTodoClick?.(item.id); onClose(); }}
                      className={`absolute inset-x-0.5 rounded-[4px] px-1.5 py-0.5 border text-white text-[9px] font-semibold overflow-hidden z-10 ${priorityBg(item.priority)} ${onTodoClick ? "cursor-pointer hover:brightness-110 transition-all" : ""}`}
                      style={{ top: Math.max(0, item.topPx) + 1, height: item.heightPx - 2 }}
                      title={item.title}
                    >
                      <span className="truncate block leading-tight">{item.title}</span>
                      {item.heightPx > 30 && (
                        <span className="opacity-60 text-[8px] block leading-tight">{item.extra}</span>
                      )}
                    </div>
                  ) : (
                    <div
                      key={`h-${item.key}`}
                      onClick={() => { onHabitClick?.(item.id); onClose(); }}
                      className={`absolute inset-x-0.5 rounded-[4px] px-1.5 py-0.5 border text-white text-[9px] font-semibold overflow-hidden z-10 bg-violet-500 border-violet-600/40 ${item.completed ? "opacity-40" : ""} ${onHabitClick ? "cursor-pointer hover:brightness-110 transition-all" : ""}`}
                      style={{ top: Math.max(0, item.topPx) + 1, height: item.heightPx - 2 }}
                      title={item.title}
                    >
                      <span className={`flex items-center gap-0.5 leading-tight ${item.completed ? "line-through" : ""}`}>
                        <Repeat size={7} className="flex-shrink-0 opacity-80" />
                        <span className="truncate">{item.title}</span>
                      </span>
                      {item.heightPx > 30 && (
                        <span className="opacity-60 text-[8px] block leading-tight">{item.extra}</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
