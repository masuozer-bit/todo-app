"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Todo } from "@/lib/types";

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

  // Build a set of dates that have todos
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

  // Calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { date: Date; dateStr: string; inMonth: boolean }[] = [];

    // Previous month trailing days
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
      cells.push({ date: d, dateStr: toDateStr(d), inMonth: false });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      cells.push({ date: d, dateStr: toDateStr(d), inMonth: true });
    }

    // Next month leading days (fill to 42 cells = 6 rows)
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

  // Count tasks for selected date
  const selectedInfo = selectedDate ? dueDateMap[selectedDate] : null;

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
          const info = dueDateMap[dateStr];
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
              {/* Dot indicator for tasks */}
              {info && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    info.hasOverdue
                      ? "bg-red-500"
                      : isToday && !isSelected
                        ? "bg-white dark:bg-black"
                        : "bg-black dark:bg-white"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date info */}
      {selectedDate && (
        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-black dark:text-white">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedInfo
                  ? `${selectedInfo.count} task${selectedInfo.count !== 1 ? "s" : ""} due`
                  : "No tasks due"}
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
        </div>
      )}
    </div>
  );
}
