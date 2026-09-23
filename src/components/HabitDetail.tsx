"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox, SkipForward, Trash2, X } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { ListPopover } from "./ui/ChoicePopovers";
import { TimePicker } from "./Pickers";
import { HabitHistory, MilestoneTrack, StatStrip, formatRate } from "./HabitStats";
import { toDateStr } from "@/lib/date-helpers";
import { formatRowDate, weekdayLabels } from "@/lib/format";
import { isScheduledForDate } from "@/lib/habit-schedule";
import type { HabitCompletion, HabitSkip, HabitWithStatus, List as ListType, ScheduleType } from "@/lib/types";

const NOTES_DEBOUNCE = 2000;
/** Stored Sunday-first, shown Monday-first. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface HabitUpdates {
  title?: string;
  schedule_type?: ScheduleType;
  schedule_days?: number[];
  schedule_interval?: number;
  time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  list_id?: string | null;
}

/**
 * Column 3 for a habit: first how it stands, then its history, then the
 * settings. Everything about one habit, in place.
 */
export default function HabitDetail({
  habit,
  lists,
  completions = [],
  skips = [],
  onClose,
  onUpdate,
  onDelete,
  onSkip,
  onToggleToday,
}: {
  habit: HabitWithStatus | null;
  lists: ListType[];
  completions?: HabitCompletion[];
  skips?: HabitSkip[];
  onClose: () => void;
  onUpdate: (id: string, updates: HabitUpdates) => void;
  onDelete: (id: string) => void;
  onSkip: (id: string) => void;
  onToggleToday?: (id: string) => void;
}) {
  const { t } = useI18n();
  const habitId = habit?.id;
  const done = useMemo(
    () => new Set(completions.filter((c) => c.habit_id === habitId).map((c) => c.completed_date)),
    [completions, habitId]
  );
  const skipped = useMemo(
    () => new Set(skips.filter((s) => s.habit_id === habitId).map((s) => s.skip_date)),
    [skips, habitId]
  );

  if (!habit) {
    return (
      <>
        <div className="app-col-head" />
        <div className="app-col-body flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Inbox size={24} className="text-text-faint" />
          <p className="text-sm text-text-muted">{t("No habit selected")}</p>
        </div>
      </>
    );
  }

  const list = habit.list_id ? lists.find((l) => l.id === habit.list_id) ?? null : null;
  const labels = weekdayLabels("narrow");

  function toggleDay(day: number) {
    if (!habit) return;
    const days = habit.schedule_days.includes(day)
      ? habit.schedule_days.filter((d) => d !== day)
      : [...habit.schedule_days, day];
    // A habit due on no day at all would never appear again
    if (days.length === 0) return;
    onUpdate(habit.id, { schedule_type: "weekly", schedule_days: days });
  }

  // Today can be ticked from here when today is one of its days
  const canTick = !!onToggleToday && (habit.dueToday || habit.completedToday);

  return (
    <>
      <div className="app-col-head">
        {canTick && (
          <button
            onClick={() => onToggleToday?.(habit.id)}
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
        )}
        <TitleField habit={habit} onRename={(title) => onUpdate(habit.id, { title })} />
        <button onClick={onClose} className="icon-btn flex-none" aria-label={t("Close")}>
          <X size={16} />
        </button>
      </div>

      <div className="app-col-body p-4">
        <StatStrip
          items={[
            { label: t("Streak"), value: String(habit.streak) },
            { label: t("Best streak"), value: String(habit.bestStreak) },
            { label: t("30 days"), value: formatRate(habit.last30) },
          ]}
        />

        <p className="section-title mt-6 mb-2">{t("Milestones")}</p>
        <MilestoneTrack streak={habit.streak} best={habit.bestStreak} />

        <p className="section-title mt-6 mb-2">{t("History")}</p>
        <HabitHistory habit={habit} done={done} skipped={skipped} />

        <p className="section-title mt-6 mb-2">{t("Repeats")}</p>
        <div className="flex items-center gap-1">
          {DAY_ORDER.map((day) => {
            const on = habit.schedule_type === "weekly" && habit.schedule_days.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                aria-pressed={on}
                className="w-8 h-8 rounded text-[13px] font-medium transition-default"
                style={{
                  background: on ? "var(--accent-soft)" : "var(--surface-2)",
                  color: on ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {labels[DAY_ORDER.indexOf(day)]}
              </button>
            );
          })}
        </div>
        {habit.schedule_type === "interval" && (
          <p className="text-[13px] text-text-faint mt-2">
            {habit.schedule_interval === 1
              ? t("Daily")
              : t("Every {n} days", { n: habit.schedule_interval })}
            {". "}
            {t("Pick weekdays to switch to a weekly rhythm.")}
          </p>
        )}

        <div className="props mt-6">
          <div className="prop-label">{t("From")}</div>
          <div className="prop-value">
            <TimePicker value={habit.time ?? ""} onChange={(v) => onUpdate(habit.id, { time: v || null })} />
          </div>
          <div className="prop-label">{t("Until")}</div>
          <div className="prop-value">
            <TimePicker value={habit.end_time ?? ""} onChange={(v) => onUpdate(habit.id, { end_time: v || null })} />
          </div>
          <div className="prop-label">{t("List")}</div>
          <div className="prop-value">
            <ListPopover
              lists={lists}
              onChange={(listId) => onUpdate(habit.id, { list_id: listId })}
              trigger={(p) => (
                <button
                  ref={p.ref as (el: HTMLButtonElement | null) => void}
                  onClick={p.onClick}
                  aria-expanded={p["aria-expanded"]}
                  className="prop-button"
                >
                  {list ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-none" style={{ background: list.color ?? "var(--text-faint)" }} />
                      {list.name}
                    </span>
                  ) : (
                    <span className="text-text-faint">{t("No list")}</span>
                  )}
                </button>
              )}
            />
          </div>
        </div>

        <Notes habit={habit} onSave={(id, notes) => onUpdate(id, { notes: notes.trim() === "" ? null : notes })} />
      </div>

      <div className="panel-foot">
        <span className="text-xs text-text-faint flex-1 min-w-0 truncate">{todayStatus(habit, t)}</span>
        {habit.dueToday && !habit.completedToday && (
          <button onClick={() => onSkip(habit.id)} className="btn btn-secondary">
            <SkipForward size={14} />
            {t("Skip today")}
          </button>
        )}
        <button onClick={() => onDelete(habit.id)} className="btn btn-text-danger">
          <Trash2 size={14} />
          {t("Delete")}
        </button>
      </div>
    </>
  );
}

/** Where the habit stands today, in a few words for the panel foot. */
function todayStatus(
  habit: HabitWithStatus,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (habit.completedToday) return t("Done today");
  if (habit.skippedToday) return t("Skipped today");
  if (habit.dueToday) return t("Due today");
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 366; i++) {
    day.setDate(day.getDate() + 1);
    if (isScheduledForDate(habit, day)) return t("Next: {date}", { date: t(formatRowDate(toDateStr(day))) });
  }
  return "";
}

function TitleField({ habit, onRename }: { habit: HabitWithStatus; onRename: (title: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(habit.title);
  const ref = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(habit.id);

  useEffect(() => {
    if (idRef.current !== habit.id || document.activeElement !== ref.current) {
      idRef.current = habit.id;
      setDraft(habit.title);
    }
  }, [habit.id, habit.title]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  function commit() {
    const next = draft.trim();
    if (next && next !== habit.title) onRename(next);
    else setDraft(habit.title);
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); ref.current?.blur(); }
        if (e.key === "Escape") { e.preventDefault(); setDraft(habit.title); ref.current?.blur(); }
      }}
      aria-label={t("Habit name")}
      className="detail-title"
    />
  );
}

function Notes({ habit, onSave }: { habit: HabitWithStatus; onSave: (id: string, notes: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(habit.notes ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(habit.id);

  useEffect(() => {
    if (idRef.current !== habit.id) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      idRef.current = habit.id;
      setDraft(habit.notes ?? "");
      return;
    }
    if (!timer.current) setDraft(habit.notes ?? "");
  }, [habit.id, habit.notes]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="mt-6">
      <p className="section-title mb-2">{t("Notes")}</p>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const id = habit.id;
          const value = e.target.value;
          timer.current = setTimeout(() => { timer.current = null; onSave(id, value); }, NOTES_DEBOUNCE);
        }}
        onBlur={() => {
          if (timer.current) { clearTimeout(timer.current); timer.current = null; }
          if (draft !== (habit.notes ?? "")) onSave(habit.id, draft);
        }}
        placeholder={t("Add a note...")}
        aria-label={t("Notes")}
        className="w-full min-h-[100px] bg-transparent text-sm leading-relaxed text-text placeholder:text-text-faint resize-none focus:outline-none"
      />
    </div>
  );
}
