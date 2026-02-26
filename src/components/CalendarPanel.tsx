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
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
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

export default function CalendarPanel({
  todos,
  selectedDate,
  onSelectDate,
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
    // Include padding days
    firstDay.setDate(firstDay.getDate() - 7);
    lastDay.setDate(lastDay.getDate() + 7);

    const result = await fetchCalendarEvents(
      toDateStr(firstDay),
      toDateStr(lastDay)
    );
    setGoogleEvents(result.events);
    setEventsLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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

  // Google events grouped by date (only non-synced ones)
  const googleEventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of googleEvents) {
      if (event.source === "synced") continue; // Skip our own synced events
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [googleEvents]);

  // Calendar grid for current month
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
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  function handleDateClick(dateStr: string) {
    if (selectedDate === dateStr) {
      onSelectDate(null);
    } else {
      onSelectDate(dateStr);
    }
  }

  // Info for selected date
  const selectedTodoInfo = selectedDate ? dueDateMap[selectedDate] : null;
  const selectedGoogleEvents = selectedDate
    ? googleEventsByDate[selectedDate] ?? []
    : [];

  return (
    <div className="glass-card p-4">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={goToToday}
          className="text-sm font-semibold text-black dark:text-white hover:opacity-70 transition-default"
        >
          {MONTH_NAMES[viewMonth]} {viewYear}
        </button>

        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map(({ dateStr, inMonth }, i) => {
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
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
            >
              <span>{dayNum}</span>
              {/* Dot indicators */}
              <div className="absolute bottom-1 flex gap-0.5">
                {todoInfo && (
                  <span
                    className={`w-1 h-1 rounded-full ${
                      todoInfo.hasOverdue
                        ? "bg-red-500"
                        : isToday && !isSelected
                          ? "bg-white dark:bg-black"
                          : "bg-black dark:bg-white"
                    }`}
                  />
                )}
                {hasGoogleEvents && (
                  <span
                    className={`w-1 h-1 rounded-full ${
                      isToday && !isSelected
                        ? "bg-blue-300"
                        : "bg-blue-500"
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Loading indicator */}
      {eventsLoading && (
        <div className="mt-2 flex items-center justify-center">
          <div className="w-3 h-3 border border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Selected date info */}
      {selectedDate && (
        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-medium text-black dark:text-white">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedTodoInfo
                  ? `${selectedTodoInfo.count} task${selectedTodoInfo.count !== 1 ? "s" : ""} due`
                  : "No tasks due"}
                {selectedGoogleEvents.length > 0 &&
                  ` · ${selectedGoogleEvents.length} event${selectedGoogleEvents.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={() => onSelectDate(null)}
              className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
              aria-label="Clear date filter"
            >
              <X size={14} />
            </button>
          </div>

          {/* Google Calendar events for selected date */}
          {selectedGoogleEvents.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {selectedGoogleEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 py-1.5 px-2 rounded-lg bg-blue-50 dark:bg-blue-950/30"
                >
                  <div className="w-1 h-full min-h-[16px] bg-blue-500 rounded-full flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-black dark:text-white truncate">
                      {event.summary}
                    </p>
                    {event.startTime && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                        <Clock size={9} />
                        {event.startTime}
                        {event.endTime && `–${event.endTime}`}
                      </p>
                    )}
                    {!event.startTime && (
                      <p className="text-[10px] text-gray-400 mt-0.5">All day</p>
                    )}
                  </div>
                  {event.htmlLink && (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-500 transition-default flex-shrink-0 mt-0.5"
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
