"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, ExternalLink, Clock } from "lucide-react";
import type { Todo } from "@/lib/types";
import { fetchCalendarEvents } from "@/lib/calendar-sync-client";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  htmlLink?: string;
  source: "google" | "synced";
}

interface CalendarPanelProps {
  todos: Todo[];
  selectedDates: string[];
  onSelectDates: (dates: string[]) => void;
}

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default function CalendarPanel({
  todos,
  selectedDates,
  onSelectDates,
}: CalendarPanelProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Fetch Google Calendar events for visible month
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    firstDay.setDate(firstDay.getDate() - 7);
    lastDay.setDate(lastDay.getDate() + 7);
    const result = await fetchCalendarEvents(toDateStr(firstDay), toDateStr(lastDay));
    setGoogleEvents(result.events);
    setEventsLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Build maps for dates
  const dueDateMap = useMemo(() => {
    const map: Record<string, { count: number; hasOverdue: boolean }> = {};
    for (const todo of todos) {
      if (!todo.due_date || todo.completed) continue;
      const key = todo.due_date;
      if (!map[key]) map[key] = { count: 0, hasOverdue: false };
      map[key].count++;
      if (key < todayStr) map[key].hasOverdue = true;
    }
    return map;
  }, [todos, todayStr]);

  const googleEventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of googleEvents) {
      if (event.source === "synced") continue;
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [googleEvents]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: { date: Date; dateStr: string; inMonth: boolean }[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
      cells.push({ date: d, dateStr: toDateStr(d), inMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      cells.push({ date: d, dateStr: toDateStr(d), inMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      cells.push({ date: d, dateStr: toDateStr(d), inMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }
  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function handleDateClick(dateStr: string) {
    const isSelected = selectedDates.includes(dateStr);
    if (isSelected) {
      onSelectDates(selectedDates.filter((d) => d !== dateStr));
    } else {
      onSelectDates([...selectedDates, dateStr]);
    }
  }

  // Summary for selected dates
  const selectedSet = new Set(selectedDates);
  const totalSelectedTasks = selectedDates.reduce(
    (sum, d) => sum + (dueDateMap[d]?.count ?? 0),
    0
  );
  const allSelectedGoogleEvents = selectedDates
    .flatMap((d) => googleEventsByDate[d] ?? [])
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });
  const sortedSelectedDates = [...selectedDates].sort();

  return (
    <div className="space-y-2">
      {/* Calendar grid pill */}
      <div className="glass-card px-3 py-3">
        {/* Month header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={goToToday}
            className="text-sm font-semibold text-black dark:text-white hover:opacity-70 transition-default"
          >
            {MONTH_NAMES[viewMonth]} {viewYear}
          </button>
          <button
            onClick={nextMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider py-1">
              {label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map(({ dateStr, inMonth }, i) => {
            const isToday = dateStr === todayStr;
            const isSelected = selectedSet.has(dateStr);
            const todoInfo = dueDateMap[dateStr];
            const hasGoogleEvents = !!googleEventsByDate[dateStr];
            const dayNum = parseInt(dateStr.split("-")[2], 10);

            return (
              <button
                key={i}
                onClick={() => handleDateClick(dateStr)}
                className={`
                  relative w-full aspect-square rounded-xl flex flex-col items-center justify-center text-xs transition-default
                  ${!inMonth ? "text-gray-300 dark:text-gray-700" : ""}
                  ${inMonth && !isToday && !isSelected ? "text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10" : ""}
                  ${isToday && !isSelected ? "bg-black dark:bg-white text-white dark:text-black font-bold" : ""}
                  ${isSelected ? "ring-2 ring-black dark:ring-white ring-inset font-bold" : ""}
                  ${isSelected && isToday ? "bg-black dark:bg-white text-white dark:text-black" : ""}
                  ${isSelected && !isToday ? "bg-black/10 dark:bg-white/15 text-black dark:text-white" : ""}
                `}
                aria-label={dateStr}
                aria-pressed={isSelected}
              >
                <span>{dayNum}</span>
                <div className="absolute bottom-1 flex gap-0.5">
                  {todoInfo && (
                    <span className={`w-1 h-1 rounded-full ${
                      todoInfo.hasOverdue ? "bg-red-500"
                      : isToday && !isSelected ? "bg-white dark:bg-black"
                      : "bg-black dark:bg-white"
                    }`} />
                  )}
                  {hasGoogleEvents && (
                    <span className={`w-1 h-1 rounded-full ${isToday && !isSelected ? "bg-white/60 dark:bg-black/60" : "bg-black/40 dark:bg-white/50"}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {eventsLoading && (
          <div className="mt-2 flex items-center justify-center">
            <div className="w-3 h-3 border border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Selected dates pill — only shown when dates are selected */}
      {selectedDates.length > 0 && (
        <div className="glass-card px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-medium text-black dark:text-white">
                {selectedDates.length === 1
                  ? formatShort(sortedSelectedDates[0])
                  : `${selectedDates.length} days selected`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalSelectedTasks > 0
                  ? `${totalSelectedTasks} task${totalSelectedTasks !== 1 ? "s" : ""} due`
                  : "No tasks due"}
                {allSelectedGoogleEvents.length > 0 &&
                  ` · ${allSelectedGoogleEvents.length} calendar event${allSelectedGoogleEvents.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={() => onSelectDates([])}
              className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
              aria-label="Clear date selection"
            >
              <X size={14} />
            </button>
          </div>

          {/* Per-date breakdown when multiple selected */}
          {selectedDates.length > 1 && (
            <div className="space-y-1 mb-2">
              {sortedSelectedDates.map((d) => {
                const info = dueDateMap[d];
                const gEvts = googleEventsByDate[d] ?? [];
                if (!info && gEvts.length === 0) return null;
                return (
                  <div key={d} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">{formatShort(d)}</span>
                    <div className="flex items-center gap-2">
                      {info && (
                        <span className={`font-medium ${info.hasOverdue ? "text-red-500" : "text-black dark:text-white"}`}>
                          {info.count} task{info.count !== 1 ? "s" : ""}
                        </span>
                      )}
                      {gEvts.length > 0 && (
                        <span className="text-blue-500">{gEvts.length} event{gEvts.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Google Calendar events for selected dates */}
          {allSelectedGoogleEvents.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {allSelectedGoogleEvents.map((event) => (
                <div key={event.id} className="glass-card-subtle flex items-start gap-2 py-1.5 px-2 rounded-lg">
                  <div className="w-1 h-full min-h-[16px] bg-black/30 dark:bg-white/40 rounded-full flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-black dark:text-white truncate">{event.summary}</p>
                    {selectedDates.length > 1 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatShort(event.date)}</p>
                    )}
                    {event.startTime ? (
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                        <Clock size={9} />
                        {event.startTime}{event.endTime && `–${event.endTime}`}
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-0.5">All day</p>
                    )}
                  </div>
                  {event.htmlLink && (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-black dark:hover:text-white transition-default flex-shrink-0 mt-0.5"
                      aria-label="Open in Google Calendar"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
