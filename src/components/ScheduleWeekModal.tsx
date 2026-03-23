"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Repeat, ChevronDown, CalendarDays } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, DragMoveEvent } from "@dnd-kit/core";
import type { Todo, HabitWithStatus, List, Event } from "@/lib/types";

/* ───────────────────────── Constants ───────────────────────── */

const VISIBLE_HOURS   = 24;
const HOUR_PX         = 64;
const TOTAL_PX        = VISIBLE_HOURS * HOUR_PX;
const SNAP_MINUTES    = 15;
const DEFAULT_DURATION = 60;

const UNSCHEDULED_W   = 260;

const DAY_SHORT   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ───────────────────────── Helpers ──────────────────────────── */

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTimeStr(min: number): string {
  const clamped = Math.max(0, Math.min(min, 24 * 60 - 1));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function minutesToLabel(min: number): string {
  const clamped = Math.max(0, Math.min(min, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function hourLabel(h: number): string {
  if (h === 0)  return "12am";
  if (h === 12) return "12pm";
  if (h === 24) return "";
  return h > 12 ? `${h-12}pm` : `${h}am`;
}

function getWeekStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0,0,0,0);
  const day = out.getDay();
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

function priorityDot(p?: string): string {
  if (p === "high")   return "bg-red-500";
  if (p === "medium") return "bg-orange-400";
  if (p === "low")    return "bg-sky-400";
  return "bg-zinc-400 dark:bg-zinc-500";
}

function formatRelDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0,0,0,0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tmrw";
  if (diff === -1) return "Yest";
  if (diff > 1 && diff <= 7) return DAY_SHORT[d.getDay()];
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/* ───────────────────── Props / Types ───────────────────────── */

interface ScheduleWeekModalProps {
  todos: Todo[];
  habits: HabitWithStatus[];
  lists?: List[];
  events?: Event[];
  onTodoClick?: (id: string) => void;
  onHabitClick?: (id: string) => void;
  onUpdateTodo?: (id: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
}

type ItemBlock = {
  key: string; type: "todo" | "habit" | "event";
  id: string; title: string; todo?: Todo;
  topPx: number; heightPx: number;
  extra: string; priority?: string; completed: boolean;
  listName?: string; eventName?: string;
};

/* ─────────────── Unscheduled Task Pill (draggable) ─────────── */

function UnscheduledPill({ todo, listName, eventName }: { todo: Todo; listName?: string; eventName?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled-${todo.id}`,
    data: { type: "unscheduled", todo },
  });

  const priorityLabel = todo.priority === "high" ? "High" : todo.priority === "medium" ? "Med" : todo.priority === "low" ? "Low" : null;
  const priorityColor = todo.priority === "high" ? "text-red-400" : todo.priority === "medium" ? "text-orange-400" : todo.priority === "low" ? "text-sky-400" : "";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`px-3 py-2.5 rounded-xl bg-black/60 hover:bg-black/70 cursor-grab active:cursor-grabbing transition-all select-none ${isDragging ? "opacity-30" : ""}`}
      title={todo.title}
    >
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${priorityDot(todo.priority)}`} />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-medium text-white leading-tight line-clamp-2">
            {todo.title}
          </span>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {priorityLabel && (
              <span className={`text-[10px] font-semibold ${priorityColor}`}>{priorityLabel}</span>
            )}
            {todo.due_date && (
              <span className="text-[10px] text-gray-500 tabular-nums">
                {formatRelDate(todo.due_date)}
              </span>
            )}
            {listName && (
              <span className="text-[10px] text-gray-600 truncate max-w-[100px]">
                {listName}
              </span>
            )}
            {eventName && (
              <span className="text-[10px] text-emerald-400/70 truncate max-w-[120px] italic">
                {eventName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────── Scheduled Block on grid (draggable) ────────── */

function ScheduledBlock({
  item,
  onTodoClick,
  onClose,
  onResizeEnd,
  onResizeTopEnd,
}: {
  item: ItemBlock;
  onTodoClick?: (id: string) => void;
  onClose: () => void;
  onResizeEnd?: (id: string, newEndTime: string) => void;
  onResizeTopEnd?: (id: string, newStartTime: string) => void;
}) {
  const isDraggableTodo = item.type === "todo";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `scheduled-${item.id}`,
    data: { type: "scheduled", todo: item.todo, itemBlock: item },
    disabled: !isDraggableTodo,
  });

  // Bottom resize state
  const [resizingBottom, setResizingBottom] = useState(false);
  const [resizeBottomHeight, setResizeBottomHeight] = useState<number | null>(null);
  const resizeBottomRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [bottomTimeLabel, setBottomTimeLabel] = useState<string | null>(null);

  // Top resize state
  const [resizingTop, setResizingTop] = useState(false);
  const [resizeTopDelta, setResizeTopDelta] = useState<{ topOffset: number; heightDelta: number } | null>(null);
  const resizeTopRef = useRef<{ startY: number; startTop: number; startHeight: number } | null>(null);
  const [topTimeLabel, setTopTimeLabel] = useState<string | null>(null);

  const resizing = resizingBottom || resizingTop;

  // Bottom resize handlers
  const handleBottomDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeBottomRef.current = { startY: e.clientY, startHeight: item.heightPx };
    setResizingBottom(true);
  }, [item.heightPx]);

  const handleBottomMove = useCallback((e: React.PointerEvent) => {
    if (!resizeBottomRef.current || !item.todo?.start_time) return;
    e.stopPropagation();
    const delta = e.clientY - resizeBottomRef.current.startY;
    const rawH = resizeBottomRef.current.startHeight + delta;
    const minPx = (SNAP_MINUTES / 60) * HOUR_PX;
    const snappedH = Math.max(minPx, Math.round(rawH / minPx) * minPx);
    setResizeBottomHeight(snappedH);
    // Calculate end time label
    const startMin = parseTime(item.todo.start_time);
    const durationMin = snapToGrid((snappedH / HOUR_PX) * 60);
    const endMin = Math.min(startMin + Math.max(SNAP_MINUTES, durationMin), 24 * 60 - 1);
    setBottomTimeLabel(minutesToLabel(endMin));
  }, [item.todo]);

  const handleBottomUp = useCallback((e: React.PointerEvent) => {
    if (!resizeBottomRef.current || !onResizeEnd || !item.todo?.start_time) {
      setResizingBottom(false); setResizeBottomHeight(null); resizeBottomRef.current = null; setBottomTimeLabel(null); return;
    }
    e.stopPropagation();
    const finalH = resizeBottomHeight ?? item.heightPx;
    const durationMin = snapToGrid((finalH / HOUR_PX) * 60);
    const startMin = parseTime(item.todo.start_time);
    const endMin = Math.min(startMin + Math.max(SNAP_MINUTES, durationMin), 24 * 60 - 1);
    onResizeEnd(item.id, minutesToTimeStr(endMin));
    setResizingBottom(false); setResizeBottomHeight(null); resizeBottomRef.current = null; setBottomTimeLabel(null);
  }, [resizeBottomHeight, item, onResizeEnd]);

  // Top resize handlers
  const handleTopDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeTopRef.current = { startY: e.clientY, startTop: item.topPx, startHeight: item.heightPx };
    setResizingTop(true);
  }, [item.topPx, item.heightPx]);

  const handleTopMove = useCallback((e: React.PointerEvent) => {
    if (!resizeTopRef.current) return;
    e.stopPropagation();
    const delta = e.clientY - resizeTopRef.current.startY;
    const minPx = (SNAP_MINUTES / 60) * HOUR_PX;
    const snappedDelta = Math.round(delta / minPx) * minPx;
    const maxDelta = resizeTopRef.current.startHeight - minPx;
    const clampedDelta = Math.min(snappedDelta, maxDelta);
    const newTop = resizeTopRef.current.startTop + clampedDelta;
    if (newTop < 0) {
      setResizeTopDelta({ topOffset: -resizeTopRef.current.startTop, heightDelta: resizeTopRef.current.startTop });
      const newStartMin = 0;
      setTopTimeLabel(minutesToLabel(newStartMin));
    } else {
      setResizeTopDelta({ topOffset: clampedDelta, heightDelta: -clampedDelta });
      const newStartMin = snapToGrid((newTop / HOUR_PX) * 60);
      setTopTimeLabel(minutesToLabel(newStartMin));
    }
  }, []);

  const handleTopUp = useCallback((e: React.PointerEvent) => {
    if (!resizeTopRef.current || !onResizeTopEnd || !item.todo?.start_time) {
      setResizingTop(false); setResizeTopDelta(null); resizeTopRef.current = null; setTopTimeLabel(null); return;
    }
    e.stopPropagation();
    const topOffset = resizeTopDelta?.topOffset ?? 0;
    const newTopPx = resizeTopRef.current.startTop + topOffset;
    const newStartMin = snapToGrid(Math.max(0, (newTopPx / HOUR_PX) * 60));
    onResizeTopEnd(item.id, minutesToTimeStr(newStartMin));
    setResizingTop(false); setResizeTopDelta(null); resizeTopRef.current = null; setTopTimeLabel(null);
  }, [resizeTopDelta, item, onResizeTopEnd]);

  // Calculate display values
  const displayTop = resizingTop && resizeTopDelta
    ? Math.max(0, item.topPx + resizeTopDelta.topOffset)
    : item.topPx;
  const displayHeight = resizingBottom && resizeBottomHeight !== null
    ? resizeBottomHeight
    : resizingTop && resizeTopDelta
      ? item.heightPx + resizeTopDelta.heightDelta
      : item.heightPx;

  // Event blocks (non-draggable)
  if (item.type === "event") {
    return (
      <div
        className="absolute inset-x-1 rounded-lg overflow-hidden z-[8] cursor-default"
        style={{ top: Math.max(0, item.topPx) + 1, height: displayHeight - 2, background: "rgba(16,185,129,0.25)", borderBottom: "3px solid rgba(16,185,129,0.6)" }}
        title={item.title}
      >
        <div className="px-2 py-1 h-full flex flex-col justify-center">
          <span className="flex items-center gap-1 leading-tight">
            <CalendarDays size={9} className="flex-shrink-0 text-emerald-400/80" />
            <span className="text-[11px] font-medium text-white truncate">{item.title}</span>
          </span>
          {displayHeight > 34 && (
            <span className="text-[9px] text-white/40 mt-0.5 pl-[18px]">{item.extra}</span>
          )}
        </div>
      </div>
    );
  }

  // Habit blocks (non-draggable)
  if (item.type === "habit") {
    return (
      <div
        className={`absolute inset-x-1 rounded-lg overflow-hidden z-10 cursor-pointer hover:scale-[1.02] transition-all ${item.completed ? "opacity-30" : ""}`}
        style={{ top: Math.max(0, item.topPx) + 1, height: displayHeight - 2, background: "rgba(100,60,180,0.5)" }}
        title={item.title}
      >
        <div className="px-2 py-1 h-full flex flex-col justify-center">
          <span className={`flex items-center gap-1 leading-tight ${item.completed ? "line-through" : ""}`}>
            <Repeat size={9} className="flex-shrink-0 text-violet-300/80" />
            <span className="text-[11px] font-medium text-white truncate">{item.title}</span>
          </span>
          {displayHeight > 34 && (
            <span className="text-[9px] text-white/40 mt-0.5 pl-[18px]">{item.extra}</span>
          )}
        </div>
      </div>
    );
  }

  // Todo blocks (draggable + resizable)
  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-x-1 rounded-lg overflow-visible z-10 ${isDragging ? "opacity-30" : ""} ${resizing ? "" : "cursor-grab active:cursor-grabbing"} hover:scale-[1.02] transition-all group/block`}
      style={{ top: Math.max(0, displayTop) + 1, height: Math.max(20, displayHeight - 2), background: "rgba(0,0,0,0.65)" }}
      title={item.title}
    >
      {/* Top resize handle + time tooltip */}
      {onResizeTopEnd && (
        <div
          className="absolute top-0 left-0 right-0 h-[8px] cursor-n-resize opacity-0 group-hover/block:opacity-100 transition-opacity z-20 flex items-center justify-center"
          style={{ marginTop: -4 }}
          onPointerDown={handleTopDown}
          onPointerMove={handleTopMove}
          onPointerUp={handleTopUp}
        >
          <div className="w-8 h-[3px] rounded-full bg-white/70" />
        </div>
      )}
      {resizingTop && topTimeLabel && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-bold tabular-nums whitespace-nowrap shadow-lg">
            {topTimeLabel}
          </span>
        </div>
      )}

      {/* Drag handle area */}
      <div
        {...attributes}
        {...listeners}
        className="px-2 py-1 overflow-hidden h-full flex flex-col justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onTodoClick?.(item.id);
          onClose();
        }}
      >
        <span className="text-[11px] font-medium text-white truncate leading-tight">{item.title}</span>
        {displayHeight > 32 && (
          <span className="text-[9px] text-white/40 mt-0.5">{item.extra}</span>
        )}
        {displayHeight > 46 && item.listName && (
          <span className="text-[8px] text-white/30 truncate">{item.listName}</span>
        )}
      </div>

      {/* Bottom resize handle + time tooltip */}
      {onResizeEnd && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[8px] cursor-s-resize opacity-0 group-hover/block:opacity-100 transition-opacity z-20 flex items-center justify-center"
          style={{ marginBottom: -4 }}
          onPointerDown={handleBottomDown}
          onPointerMove={handleBottomMove}
          onPointerUp={handleBottomUp}
        >
          <div className="w-8 h-[3px] rounded-full bg-white/70" />
        </div>
      )}
      {resizingBottom && bottomTimeLabel && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-bold tabular-nums whitespace-nowrap shadow-lg">
            {bottomTimeLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Droppable Day Column ──────────────────── */

function DayColumn({
  dayStr,
  isToday,
  items,
  hourSlots,
  nowTopPx,
  snapPreview,
  onTodoClick,
  onHabitClick,
  onClose,
  onResizeEnd,
  onResizeTopEnd,
}: {
  dayStr: string;
  isToday: boolean;
  items: ItemBlock[];
  hourSlots: number[];
  nowTopPx: number;
  snapPreview: { dayStr: string; y: number; timeLabel: string } | null;
  onTodoClick?: (id: string) => void;
  onHabitClick?: (id: string) => void;
  onClose: () => void;
  onResizeEnd?: (id: string, newEndTime: string) => void;
  onResizeTopEnd?: (id: string, newStartTime: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayStr}`,
    data: { type: "day-column", dayStr },
  });

  return (
    <div
      ref={setNodeRef}
      id={`day-col-${dayStr}`}
      className={`flex-1 relative border-l border-white/[0.04] transition-colors ${isToday ? "bg-white/[0.02]" : ""} ${isOver ? "bg-white/[0.04]" : ""}`}
      style={{ height: TOTAL_PX }}
    >
      {hourSlots.map(h => (
        <div key={h} className="absolute left-0 right-0 pointer-events-none" style={{ top: h * HOUR_PX, height: 1, backgroundColor: "rgba(255,255,255,0.04)" }} />
      ))}
      {isToday && nowTopPx >= 0 && nowTopPx <= TOTAL_PX && (
        <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTopPx, height: 1.5, backgroundColor: "rgb(239,68,68)" }}>
          <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
        </div>
      )}

      {/* Snap preview line with time label */}
      {snapPreview && snapPreview.dayStr === dayStr && (
        <>
          <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: snapPreview.y, height: 2, backgroundColor: "rgba(99,102,241,0.7)" }} />
          <div className="absolute z-40 pointer-events-none" style={{ top: snapPreview.y - 8, left: 2 }}>
            <span className="px-1 py-0.5 rounded bg-indigo-500 text-white text-[8px] font-bold tabular-nums shadow-lg">
              {snapPreview.timeLabel}
            </span>
          </div>
        </>
      )}

      {items.map(item => (
        <ScheduledBlock
          key={item.key}
          item={item}
          onTodoClick={item.type === "todo" ? onTodoClick : item.type === "habit" ? onHabitClick : undefined}
          onClose={onClose}
          onResizeEnd={item.type === "todo" ? onResizeEnd : undefined}
          onResizeTopEnd={item.type === "todo" ? onResizeTopEnd : undefined}
        />
      ))}
    </div>
  );
}

/* ───────────── Unscheduled Panel (droppable zone) ──────────── */

function UnscheduledPanel({
  todos,
  listMap,
  eventMap,
}: {
  todos: Todo[];
  listMap: Map<string, string>;
  eventMap: Map<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unscheduled-pool",
    data: { type: "unscheduled-pool" },
  });

  // Group todos by urgency, then by list within each
  const groups = useMemo(() => {
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    const todayStr = toDateStr(todayDate);
    const endOfWeek = new Date(todayDate);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    const endOfWeekStr = toDateStr(endOfWeek);

    type UrgencyBucket = { id: string; label: string; color: string; todos: Todo[] };
    const buckets: UrgencyBucket[] = [
      { id: "overdue", label: "Overdue", color: "text-red-400", todos: [] },
      { id: "today", label: "Today", color: "text-amber-400", todos: [] },
      { id: "this-week", label: "This Week", color: "text-blue-400", todos: [] },
      { id: "upcoming", label: "Upcoming", color: "text-gray-400", todos: [] },
      { id: "someday", label: "Someday", color: "text-gray-600", todos: [] },
    ];

    for (const t of todos) {
      const due = t.due_date || t.start_date;
      if (!due) {
        buckets[4].todos.push(t); // someday
      } else if (due < todayStr) {
        buckets[0].todos.push(t); // overdue
      } else if (due === todayStr) {
        buckets[1].todos.push(t); // today
      } else if (due <= endOfWeekStr) {
        buckets[2].todos.push(t); // this week
      } else {
        buckets[3].todos.push(t); // upcoming
      }
    }

    // Sort within each bucket by priority (high first), then group by list
    const prioOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    type SubGroup = { id: string; name: string; todos: Todo[] };
    type Section = { id: string; label: string; color: string; subGroups: SubGroup[] };
    const sections: Section[] = [];

    for (const bucket of buckets) {
      if (bucket.todos.length === 0) continue;
      bucket.todos.sort((a, b) => (prioOrder[a.priority ?? ""] ?? 3) - (prioOrder[b.priority ?? ""] ?? 3));
      const noList: Todo[] = [];
      const byList = new Map<string, { name: string; todos: Todo[] }>();
      for (const t of bucket.todos) {
        if (t.list_id && listMap.has(t.list_id)) {
          const existing = byList.get(t.list_id);
          if (existing) existing.todos.push(t);
          else byList.set(t.list_id, { name: listMap.get(t.list_id)!, todos: [t] });
        } else {
          noList.push(t);
        }
      }
      const subGroups: SubGroup[] = [];
      if (noList.length > 0) subGroups.push({ id: `${bucket.id}__none`, name: "No List", todos: noList });
      for (const [id, group] of byList) {
        subGroups.push({ id: `${bucket.id}__${id}`, name: group.name, todos: group.todos });
      }
      sections.push({ id: bucket.id, label: bucket.label, color: bucket.color, subGroups });
    }

    return sections;
  }, [todos, listMap]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 border-r border-white/[0.06] flex flex-col transition-colors ${isOver ? "bg-indigo-500/[0.06]" : ""}`}
      style={{ width: UNSCHEDULED_W }}
    >
      <div className="px-4 py-3 border-b border-white/[0.05]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Unscheduled
        </span>
        <span className="ml-2 text-[11px] text-gray-600 tabular-nums">
          {todos.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {todos.length === 0 && (
          <p className="text-[11px] text-gray-600 text-center py-8 select-none">
            All tasks scheduled
          </p>
        )}
        {groups.map(section => (
          <div key={section.id} className="mb-3">
            {/* Urgency header */}
            <div className="flex items-center gap-2 px-2 pt-2 pb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${section.color}`}>
                {section.label}
              </span>
              <span className="text-[10px] text-gray-600 tabular-nums">
                {section.subGroups.reduce((sum, g) => sum + g.todos.length, 0)}
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            {/* List sub-groups */}
            {section.subGroups.map(group => (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-white/[0.04] rounded-lg transition-colors"
                >
                  <ChevronDown
                    size={9}
                    className={`text-gray-600 flex-shrink-0 transition-transform ${collapsed.has(group.id) ? "-rotate-90" : ""}`}
                  />
                  <span className="text-[10px] font-medium text-gray-500 truncate">
                    {group.name}
                  </span>
                  <span className="text-[10px] text-gray-600 tabular-nums ml-auto flex-shrink-0">
                    {group.todos.length}
                  </span>
                </button>
                {!collapsed.has(group.id) && (
                  <div className="px-1 pb-1.5 space-y-1.5">
                    {group.todos.map(t => (
                      <UnscheduledPill key={t.id} todo={t} listName={t.list_id ? listMap.get(t.list_id) : undefined} eventName={t.event_id ? eventMap.get(t.event_id) : undefined} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════ MAIN COMPONENT ═══════════════════════ */

export default function ScheduleWeekModal({
  todos, habits, lists, events, onTodoClick, onHabitClick, onUpdateTodo, onClose,
}: ScheduleWeekModalProps) {

  const now      = useMemo(() => new Date(), []);
  const today    = useMemo(() => { const d = new Date(now); d.setHours(0,0,0,0); return d; }, [now]);
  const todayStr = toDateStr(today);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lookup maps
  const listMap = useMemo(() => {
    const m = new Map<string, string>();
    lists?.forEach(l => m.set(l.id, l.name));
    return m;
  }, [lists]);

  const eventMap = useMemo(() => {
    const m = new Map<string, string>();
    events?.forEach(ev => m.set(ev.id, ev.title));
    return m;
  }, [events]);

  // DnD state
  const [activeItem, setActiveItem] = useState<{ todo: Todo; type: string } | null>(null);
  const [snapPreview, setSnapPreview] = useState<{ dayStr: string; y: number; timeLabel: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Auto-scroll on open
  useEffect(() => {
    if (scrollRef.current) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const target = (nowMin / 60) * HOUR_PX - HOUR_PX * 1.5;
      scrollRef.current.scrollTop = Math.max(0, target);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Days Mon → Sun
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
  [weekStart]);

  const weekEnd       = days[6];
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(getWeekStart(today));

  const startLabel = `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
  const endLabel   = weekEnd.getMonth() !== weekStart.getMonth()
    ? `${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}`
    : `${weekEnd.getDate()}`;
  const weekLabel  = `${startLabel} – ${endLabel}, ${weekEnd.getFullYear()}`;

  const nowTopPx = useMemo(() => {
    const min = now.getHours() * 60 + now.getMinutes();
    return (min / 60) * HOUR_PX;
  }, [now]);

  const hourSlots = useMemo(() =>
    Array.from({ length: VISIBLE_HOURS + 1 }, (_, i) => i),
  []);

  // Unscheduled todos
  const unscheduledTodos = useMemo(() =>
    todos.filter(t => !t.completed && !t.start_time),
  [todos]);

  // Per-day item blocks
  const dayColumns = useMemo(() => {
    return days.map(day => {
      const dayStr = toDateStr(day);
      const items: ItemBlock[] = [];

      // Todos
      todos
        .filter(t => !t.completed && !!t.start_time && (t.due_date === dayStr || t.start_date === dayStr))
        .forEach(t => {
          const startMin = parseTime(t.start_time!);
          const endMin   = t.end_time ? parseTime(t.end_time) : startMin + 30;
          const topPx    = (startMin / 60) * HOUR_PX;
          const heightPx = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX);
          if (topPx > TOTAL_PX || topPx + heightPx < 0) return;
          items.push({
            key: t.id, type: "todo", id: t.id, title: t.title, todo: t,
            topPx, heightPx,
            extra: `${t.start_time}${t.end_time ? `–${t.end_time}` : ""}`,
            priority: t.priority ?? undefined, completed: false,
            listName: t.list_id ? listMap.get(t.list_id) : undefined,
            eventName: t.event_id ? eventMap.get(t.event_id) : undefined,
          });
        });

      // Events with time slots
      events?.forEach(ev => {
        if (!ev.start_time || !ev.due_date) return;
        // Check if event falls on this day (single day or date range)
        const evStart = ev.due_date;
        const evEnd = ev.end_date || ev.due_date;
        if (dayStr < evStart || dayStr > evEnd) return;

        const startMin = parseTime(ev.start_time);
        const endMin = ev.end_time ? parseTime(ev.end_time) : startMin + 60;
        const topPx = (startMin / 60) * HOUR_PX;
        const heightPx = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX);
        if (topPx > TOTAL_PX || topPx + heightPx < 0) return;
        items.push({
          key: `ev-${ev.id}`, type: "event", id: ev.id, title: ev.title,
          topPx, heightPx,
          extra: `${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ""}`,
          priority: undefined, completed: false,
        });
      });

      // Habits
      habits
        .filter(h => !!h.time && isScheduledForDate(h, day))
        .forEach(h => {
          const startMin = parseTime(h.time!);
          const endMin   = h.end_time ? parseTime(h.end_time) : startMin + 30;
          const topPx    = (startMin / 60) * HOUR_PX;
          const heightPx = Math.max(18, ((endMin - startMin) / 60) * HOUR_PX);
          if (topPx > TOTAL_PX || topPx + heightPx < 0) return;
          items.push({
            key: h.id, type: "habit", id: h.id, title: h.title,
            topPx, heightPx,
            extra: `${h.time}${h.end_time ? `–${h.end_time}` : ""}`,
            completed: h.completedToday,
          });
        });

      return { day, dayStr, isToday: dayStr === todayStr, items };
    });
  }, [days, todos, habits, events, todayStr, listMap, eventMap]);

  /* ─────────── DnD Handlers ─────────── */

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.todo) {
      setActiveItem({ todo: data.todo, type: data.type });
    }
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { over } = event;
    if (!over || over.data.current?.type !== "day-column") {
      setSnapPreview(null);
      return;
    }
    const dayStr = over.data.current.dayStr as string;
    const col = document.getElementById(`day-col-${dayStr}`);
    if (!col || !scrollRef.current) { setSnapPreview(null); return; }

    const rect = col.getBoundingClientRect();
    const pointerY = (event.activatorEvent as PointerEvent).clientY + event.delta.y;
    const yInGrid = pointerY - rect.top + scrollRef.current.scrollTop;
    const rawMin = (yInGrid / HOUR_PX) * 60;
    const snappedMin = snapToGrid(Math.max(0, Math.min(rawMin, 24 * 60 - SNAP_MINUTES)));
    const snapY = (snappedMin / 60) * HOUR_PX;
    setSnapPreview({ dayStr, y: snapY, timeLabel: minutesToLabel(snappedMin) });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveItem(null);
    setSnapPreview(null);

    const { active, over } = event;
    if (!over || !onUpdateTodo) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    const todo: Todo | undefined = activeData?.todo;
    if (!todo) return;

    if (overData?.type === "unscheduled-pool") {
      onUpdateTodo(todo.id, { start_time: null, end_time: null });
      return;
    }

    if (overData?.type === "day-column") {
      const dayStr = overData.dayStr as string;
      const col = document.getElementById(`day-col-${dayStr}`);
      if (!col || !scrollRef.current) return;

      const rect = col.getBoundingClientRect();
      const pointerY = (event.activatorEvent as PointerEvent).clientY + event.delta.y;
      const yInGrid = pointerY - rect.top + scrollRef.current.scrollTop;
      const rawMin = (yInGrid / HOUR_PX) * 60;
      const snappedStart = snapToGrid(Math.max(0, Math.min(rawMin, 24 * 60 - SNAP_MINUTES)));

      let durationMin = DEFAULT_DURATION;
      if (todo.start_time && todo.end_time) {
        durationMin = parseTime(todo.end_time) - parseTime(todo.start_time);
        if (durationMin <= 0) durationMin = DEFAULT_DURATION;
      }

      const endMin = Math.min(snappedStart + durationMin, 24 * 60 - 1);

      onUpdateTodo(todo.id, {
        start_time: minutesToTimeStr(snappedStart),
        end_time: minutesToTimeStr(endMin),
        due_date: dayStr,
        start_date: dayStr,
      });
    }
  }, [onUpdateTodo]);

  const handleResizeEnd = useCallback((todoId: string, newEndTime: string) => {
    onUpdateTodo?.(todoId, { end_time: newEndTime });
  }, [onUpdateTodo]);

  const handleResizeTopEnd = useCallback((todoId: string, newStartTime: string) => {
    onUpdateTodo?.(todoId, { start_time: newStartTime });
  }, [onUpdateTodo]);

  /* ─────────── Navigation ─────────── */

  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
  }

  /* ─────────── Overlay block ─────────── */

  const overlayBlock = activeItem ? (() => {
    const todo = activeItem.todo;
    let blockH = (DEFAULT_DURATION / 60) * HOUR_PX;
    let timeRange = "";
    if (todo.start_time && todo.end_time) {
      const dur = parseTime(todo.end_time) - parseTime(todo.start_time);
      blockH = Math.max(20, (dur / 60) * HOUR_PX);
    }
    // Show time in overlay if snap preview available
    if (snapPreview) {
      const startMin = snapToGrid(snapPreview.y / HOUR_PX * 60);
      let dur = DEFAULT_DURATION;
      if (todo.start_time && todo.end_time) {
        dur = parseTime(todo.end_time) - parseTime(todo.start_time);
        if (dur <= 0) dur = DEFAULT_DURATION;
      }
      const endMin = Math.min(startMin + dur, 24 * 60 - 1);
      timeRange = `${minutesToLabel(startMin)} – ${minutesToLabel(endMin)}`;
    }
    return (
      <div
        className="rounded-lg px-2.5 py-1.5 text-white shadow-lg pointer-events-none"
        style={{ width: 140, height: blockH, opacity: 0.9, background: "rgba(0,0,0,0.75)" }}
      >
        <span className="text-[11px] font-medium truncate block">{todo.title}</span>
        {timeRange && (
          <span className="text-[9px] text-white/50 block tabular-nums mt-0.5">{timeRange}</span>
        )}
      </div>
    );
  })() : null;

  /* ─────────── Render ─────────── */

  const modal = (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 flex flex-col overflow-hidden bg-white/[0.02] dark:bg-white/[0.02]"
        onClick={e => e.stopPropagation()}
      >
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
            <button onClick={prevWeek} className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-gray-400 hover:text-white transition-default">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-3 flex-1 justify-center">
              <span className="text-base font-bold text-white tabular-nums">{weekLabel}</span>
              {!isCurrentWeek && (
                <button onClick={() => setWeekStart(getWeekStart(today))} className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.12] transition-default">
                  Today
                </button>
              )}
            </div>
            <button onClick={nextWeek} className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-gray-400 hover:text-white transition-default">
              <ChevronRight size={16} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-gray-500 hover:text-white transition-default">
              <X size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="flex border-b border-white/[0.06] flex-shrink-0" style={{ paddingLeft: UNSCHEDULED_W + 48 }}>
            {dayColumns.map(({ day, isToday: isTodayCol }) => (
              <div key={toDateStr(day)} className="flex-1 flex flex-col items-center py-3 gap-1">
                <span className={`text-[11px] uppercase tracking-wider font-medium ${isTodayCol ? "text-white" : "text-gray-500"}`}>
                  {DAY_SHORT[day.getDay()]}
                </span>
                <span className={`text-sm font-bold tabular-nums leading-none ${
                  isTodayCol
                    ? "w-8 h-8 rounded-full bg-white text-black flex items-center justify-center"
                    : "text-gray-300"
                }`}>
                  {day.getDate()}
                </span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            <UnscheduledPanel todos={unscheduledTodos} listMap={listMap} eventMap={eventMap} />

            <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0">
              <div className="flex" style={{ height: TOTAL_PX }}>
                <div className="flex-shrink-0 relative" style={{ width: 48 }}>
                  {hourSlots.map(h => h < 24 && (
                    <div key={h} className="absolute right-0 pr-2" style={{ top: h * HOUR_PX - 7 }}>
                      <span className="text-[10px] text-gray-600 tabular-nums leading-none">{hourLabel(h)}</span>
                    </div>
                  ))}
                </div>

                {dayColumns.map(({ dayStr, isToday: isTodayCol, items }) => (
                  <DayColumn
                    key={dayStr}
                    dayStr={dayStr}
                    isToday={isTodayCol}
                    items={items}
                    hourSlots={hourSlots}
                    nowTopPx={nowTopPx}
                    snapPreview={snapPreview}
                    onTodoClick={onTodoClick}
                    onHabitClick={onHabitClick}
                    onClose={onClose}
                    onResizeEnd={handleResizeEnd}
                    onResizeTopEnd={handleResizeTopEnd}
                  />
                ))}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {overlayBlock}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
