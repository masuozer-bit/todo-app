"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { toDateStr } from "@/lib/date-helpers";
import { isScheduledForDate } from "@/lib/habit-schedule";
import { weekdayLabels } from "@/lib/format";
import type { HabitCompletion, HabitWithStatus } from "@/lib/types";

function weekStartOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

/**
 * The week as a table, seven columns, in the content column. One row per
 * habit: a filled mark on the days it was done, an empty one on the days it
 * was due, nothing where it was not scheduled.
 */
export default function HabitWeekTable({
  habits,
  completions,
}: {
  habits: HabitWithStatus[];
  completions: HabitCompletion[];
}) {
  const { t } = useI18n();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [start, setStart] = useState(() => weekStartOf(today));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const labels = weekdayLabels("short");
  const todayStr = toDateStr(today);
  const isCurrentWeek = toDateStr(start) === toDateStr(weekStartOf(today));

  const doneByHabit = new Map<string, Set<string>>();
  for (const completion of completions) {
    const set = doneByHabit.get(completion.habit_id) ?? new Set<string>();
    set.add(completion.completed_date);
    doneByHabit.set(completion.habit_id, set);
  }

  function step(weeks: number) {
    const d = new Date(start);
    d.setDate(d.getDate() + weeks * 7);
    setStart(d);
  }

  if (habits.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-1 mb-2">
        <p className="section-title flex-1">{t("Week")}</p>
        <button onClick={() => step(-1)} className="icon-btn w-7 h-7" aria-label={t("Previous week")}>
          <ChevronLeft size={16} />
        </button>
        {!isCurrentWeek && (
          <button onClick={() => setStart(weekStartOf(today))} className="btn btn-ghost h-7 px-2 text-xs">
            {t("Today")}
          </button>
        )}
        <button onClick={() => step(1)} className="icon-btn w-7 h-7" aria-label={t("Next week")}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs font-normal text-text-faint pb-2 pr-3">{t("Habit")}</th>
              {days.map((day, i) => {
                const isToday = toDateStr(day) === todayStr;
                return (
                  <th
                    key={day.toISOString()}
                    className="text-center text-xs font-normal pb-2 w-10"
                    style={{ color: isToday ? "var(--accent)" : "var(--text-faint)" }}
                  >
                    <span className="block">{labels[i]}</span>
                    <span className="block tabular-nums">{day.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => {
              const done = doneByHabit.get(habit.id) ?? new Set<string>();
              return (
                <tr key={habit.id} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-[13px] text-text truncate max-w-[220px]">{habit.title}</td>
                  {days.map((day) => {
                    const ymd = toDateStr(day);
                    const scheduled = isScheduledForDate(habit, day);
                    const isDone = done.has(ymd);
                    return (
                      <td key={ymd} className="py-1.5 text-center">
                        {scheduled ? (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                            style={{
                              background: isDone ? "var(--accent)" : "transparent",
                              border: isDone ? "none" : "1px solid var(--border-strong)",
                              color: "var(--accent-contrast)",
                            }}
                            aria-label={isDone ? t("Done") : t("Open")}
                          >
                            {isDone && <Check size={11} strokeWidth={3} />}
                          </span>
                        ) : (
                          <span className="text-text-faint" aria-hidden="true">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
