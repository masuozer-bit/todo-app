"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { toDateStr } from "@/lib/date-helpers";
import { isScheduledForDate } from "@/lib/habit-schedule";
import { formatDateWithWeekday, weekdayLabels } from "@/lib/format";
import type { HabitCompletion, HabitSkip, HabitWithStatus } from "@/lib/types";

function weekStartOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

/**
 * The week as a table, seven columns, in the content column. One row per
 * habit: a filled mark on the days it was done, an empty one on the days it
 * was due, a dashed one where it was skipped, nothing where it was not
 * scheduled. Every day up to today can be ticked here, so a forgotten
 * evening does not cost the streak.
 */
export default function HabitWeekTable({
  habits,
  completions,
  skips = [],
  selectedId = null,
  onToggle,
  onSelect,
}: {
  habits: HabitWithStatus[];
  completions: HabitCompletion[];
  skips?: HabitSkip[];
  selectedId?: string | null;
  onToggle?: (habitId: string, date: string) => void;
  onSelect?: (habitId: string) => void;
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
  const skipped = new Set(skips.map((s) => `${s.habit_id}:${s.skip_date}`));

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
                  <td className="py-1 pr-3 max-w-[220px]">
                    <button
                      onClick={() => onSelect?.(habit.id)}
                      className={`block w-full text-left text-[13px] truncate ${
                        selectedId === habit.id ? "text-accent" : "text-text hover:text-accent"
                      }`}
                      aria-current={selectedId === habit.id ? "true" : undefined}
                    >
                      {habit.title}
                    </button>
                  </td>
                  {days.map((day) => {
                    const ymd = toDateStr(day);
                    const isDone = done.has(ymd);
                    const scheduled = isScheduledForDate(habit, day) || isDone;
                    const isSkipped = !isDone && skipped.has(`${habit.id}:${ymd}`);
                    const editable = scheduled && ymd <= todayStr && !!onToggle;
                    const mark = (
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                        style={{
                          background: isDone ? "var(--accent)" : "transparent",
                          border: isDone
                            ? "none"
                            : `1px ${isSkipped ? "dashed" : "solid"} ${ymd > todayStr ? "var(--border)" : "var(--border-strong)"}`,
                          color: "var(--accent-contrast)",
                        }}
                      >
                        {isDone && <Check size={11} strokeWidth={3} />}
                      </span>
                    );
                    const state = isDone ? t("Done") : isSkipped ? t("Skipped") : t("Open");
                    return (
                      <td key={ymd} className="py-1 text-center">
                        {!scheduled ? (
                          <span className="text-text-faint" aria-hidden="true">·</span>
                        ) : editable ? (
                          <button
                            onClick={() => onToggle?.(habit.id, ymd)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-2"
                            aria-pressed={isDone}
                            aria-label={`${habit.title}, ${formatDateWithWeekday(ymd)}: ${state}`}
                          >
                            {mark}
                          </button>
                        ) : (
                          <span className="inline-flex items-center justify-center w-8 h-8" aria-label={state}>
                            {mark}
                          </span>
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
