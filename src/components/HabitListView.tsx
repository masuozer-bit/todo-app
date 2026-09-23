"use client";

import { useI18n } from "./I18nProvider";
import { HabitProgress, HabitTrail, StatStrip, StreakLabel, formatRate } from "./HabitStats";
import ProgressRing from "./ui/ProgressRing";
import { formatTime, weekdayLabels } from "@/lib/format";
import { sumTallies } from "@/lib/habit-stats";
import type { HabitWithStatus, List as ListType } from "@/lib/types";

/**
 * The home of the habits. On top, how today and the last weeks went; then
 * what is due today, then everything else. A row says what the habit is,
 * no more; changing it happens in the panel.
 */
export default function HabitListView({
  habits,
  lists = [],
  selectedId,
  onSelect,
  onToggle,
  loading,
}: {
  habits: HabitWithStatus[];
  lists?: ListType[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (habitId: string) => void;
  loading?: boolean;
}) {
  const { t } = useI18n();
  if (loading) return null;

  if (habits.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-text-muted">{t("No habits yet")}</p>
        <p className="text-[13px] text-text-faint mt-1">{t("Start with one small thing you want to do every day")}</p>
      </div>
    );
  }

  const due = habits.filter((h) => h.dueToday);
  // A habit skipped today still belongs to today, it just rests
  const today = [...due, ...habits.filter((h) => h.skippedToday && !h.dueToday)];
  const other = habits.filter((h) => !h.dueToday && !h.skippedToday);
  const doneToday = due.filter((h) => h.completedToday).length;

  return (
    <>
      <div className="mb-6">
        <StatStrip
          items={[
            {
              label: t("Today"),
              value: due.length > 0 ? `${doneToday}/${due.length}` : null,
              extra: <ProgressRing percent={(doneToday / Math.max(due.length, 1)) * 100} />,
            },
            { label: t("7 days"), value: formatRate(sumTallies(habits.map((h) => h.last7))) },
            { label: t("30 days"), value: formatRate(sumTallies(habits.map((h) => h.last30))) },
          ]}
        />
      </div>

      <div role="listbox" aria-label={t("Habits")}>
        {today.length > 0 && (
          <Group
            label={t("Today")}
            count={`${doneToday}/${due.length}`}
            extra={<HabitProgress done={doneToday} total={due.length} />}
          >
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
          <Group label={t("Other days")} count={String(other.length)}>
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
    </>
  );
}

function Group({
  label,
  count,
  extra,
  children,
}: {
  label: string;
  count: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="habit-block">
      <div className="group-head">
        <span className="truncate">{label}</span>
        {extra}
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
  const move = (direction: -1 | 1) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-task-row]"));
    rows[rows.indexOf(document.activeElement as HTMLElement) + direction]?.focus();
  };

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      data-task-row=""
      onClick={() => onSelect(habit.id)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
        if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        if (e.key === "Enter") { e.preventDefault(); onSelect(habit.id); }
        if (e.key === " ") { e.preventDefault(); onToggle(habit.id); }
      }}
      className={`task-row ${selected ? "is-selected" : ""} ${habit.completedToday ? "is-kept" : ""}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(habit.id); }}
        className="task-circle is-habit"
        aria-label={habit.completedToday ? t("Mark as not done") : t("Mark as done")}
        aria-pressed={habit.completedToday}
      >
        {habit.completedToday && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
      <span className="task-row-title" style={habit.skippedToday && !habit.completedToday ? { color: "var(--text-faint)" } : undefined}>
        {habit.title}
      </span>
      <span className="task-row-meta">
        {habit.skippedToday && !habit.completedToday && <span className="task-meta-item">{t("Skipped")}</span>}
        {showSchedule && <span className="task-meta-tag">{scheduleLabel(habit, t)}</span>}
        {list && (
          <span className="task-meta-item task-meta-list">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: list.color ?? "var(--text-faint)" }} />
            {list.name}
          </span>
        )}
        {time && <span className="tabular-nums">{time}</span>}
        <StreakLabel streak={habit.streak} />
        <HabitTrail trail={habit.trail} />
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
