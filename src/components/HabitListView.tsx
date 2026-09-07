"use client";

import { Flame } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { formatTime, weekdayLabels } from "@/lib/format";
import type { HabitWithStatus, List as ListType } from "@/lib/types";

/**
 * Two groups: what is due today, and everything else. A row says what the
 * habit is, no more; changing it happens in the panel.
 */
export default function HabitListView({
  habits,
  todayHabitIds = [],
  lists = [],
  selectedId,
  onSelect,
  onToggle,
  loading,
}: {
  habits: HabitWithStatus[];
  todayHabitIds?: string[];
  lists?: ListType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (habitId: string) => void;
  loading?: boolean;
}) {
  const { t } = useI18n();
  if (loading) return null;

  const dueToday = new Set(todayHabitIds);
  const today = habits.filter((h) => dueToday.has(h.id));
  const other = habits.filter((h) => !dueToday.has(h.id));

  if (habits.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-text-muted">{t("No habits yet")}</p>
        <p className="text-[13px] text-text-faint mt-1">{t("Add one above to get started")}</p>
      </div>
    );
  }

  return (
    <div role="listbox" aria-label={t("Habits")}>
      {today.length > 0 && (
        <Group label={t("Today")} count={today.length}>
          {today.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              lists={lists}
              selected={selectedId === habit.id}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </Group>
      )}
      {other.length > 0 && (
        <Group label={t("Other days")} count={other.length}>
          {other.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              lists={lists}
              selected={selectedId === habit.id}
              onSelect={onSelect}
              onToggle={onToggle}
              showSchedule
            />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="group-head">
        <span className="truncate">{label}</span>
        <span className="group-head-count">{count}</span>
      </div>
      {children}
    </div>
  );
}

function HabitRow({
  habit,
  lists,
  selected,
  onSelect,
  onToggle,
  showSchedule = false,
}: {
  habit: HabitWithStatus;
  lists: ListType[];
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  showSchedule?: boolean;
}) {
  const { t } = useI18n();
  const list = habit.list_id ? lists.find((l) => l.id === habit.list_id) ?? null : null;
  const time = habit.time ? formatTime(habit.time) : null;

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      data-task-row=""
      onClick={() => onSelect(habit.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onSelect(habit.id); }
        if (e.key === " ") { e.preventDefault(); onToggle(habit.id); }
      }}
      className={`task-row ${selected ? "is-selected" : ""} ${habit.completedToday ? "is-done" : ""}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(habit.id); }}
        className="task-circle"
        aria-label={habit.completedToday ? t("Mark as not done") : t("Mark as done")}
        aria-pressed={habit.completedToday}
      >
        {habit.completedToday && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
      <span className="task-row-title">{habit.title}</span>
      <span className="task-row-meta">
        {showSchedule && <span className="task-meta-tag">{scheduleLabel(habit, t)}</span>}
        {list && (
          <span className="task-meta-item task-meta-list">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: list.color ?? "var(--text-faint)" }} />
            {list.name}
          </span>
        )}
        {habit.streak > 0 && (
          <span className="task-meta-item">
            <Flame size={14} />
            <span className="tabular-nums">{habit.streak}</span>
          </span>
        )}
        {time && <span className="tabular-nums">{time}</span>}
      </span>
    </div>
  );
}

export function scheduleLabel(
  habit: { schedule_type: string; schedule_days: number[]; schedule_interval: number },
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (habit.schedule_type === "weekly") {
    const labels = weekdayLabels("short");
    // The stored days are Sunday-first; the labels start on Monday
    return habit.schedule_days
      .slice()
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((d) => labels[(d + 6) % 7])
      .join(", ");
  }
  if (habit.schedule_interval === 1) return t("Daily");
  return t("Every {n} days", { n: habit.schedule_interval });
}
