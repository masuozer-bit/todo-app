"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List as ListIcon, Plus } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import TodoInput from "@/components/TodoInput";
import NowCard from "@/components/focus/NowCard";
import FocusRow from "@/components/focus/FocusRow";
import FocusHabitRow, { type DayState } from "@/components/focus/FocusHabitRow";
import WeekPanel, { type WeekDay } from "@/components/focus/WeekPanel";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { collectFocusItems, isoWeekNumber, orderFocusItems, weekDays } from "@/lib/focus";
import { formatLocale } from "@/lib/format";
import { isScheduledForDate } from "@/lib/habit-schedule";
import { toDateStr, getTomorrow } from "@/lib/date-helpers";
import type {
  Event,
  HabitCompletion,
  HabitOccurrence,
  HabitWithStatus,
  List,
  Tag,
  Todo,
} from "@/lib/types";

/** Rows shown at once before the list offers to open up. */
const VISIBLE_ROWS = 7;

interface FocusViewProps {
  todos: Todo[];
  todaysHabits: HabitWithStatus[];
  habitCompletions: HabitCompletion[];
  habitsForDates: (dates: string[]) => HabitOccurrence[];
  lists: List[];
  tags: Tag[];
  events: Event[];
  /** Flips at midnight, so an open tab does not keep yesterday's day. */
  todayStr: string;
  onToggleTodo: (id: string, completed: boolean) => void;
  onUpdateTodo: (id: string, updates: { due_date?: string | null }) => void;
  onToggleHabit: (habitId: string, date?: string) => void;
  onAddTodo: React.ComponentProps<typeof TodoInput>["onAdd"];
  onCreateTag?: (name: string) => Promise<Tag | undefined>;
  /** Leaves the focus view and opens this task in the full app. */
  onOpenTask: (id: string) => void;
  /** Leaves the focus view and shows this day. */
  onOpenDay: (date: string) => void;
  onExit: () => void;
}

export default function FocusView({
  todos,
  todaysHabits,
  habitCompletions,
  habitsForDates,
  lists,
  tags,
  events,
  todayStr,
  onToggleTodo,
  onUpdateTodo,
  onToggleHabit,
  onAddTodo,
  onCreateTag,
  onOpenTask,
  onOpenDay,
  onExit,
}: FocusViewProps) {
  const { t } = useI18n();
  // The keyboard shifts the visual viewport on a phone, same as in the shell
  useVisualViewport();

  // The toast stack centres itself on the content column; in this view there
  // is no navigation to offset it against
  useEffect(() => {
    document.documentElement.dataset.focusView = "on";
    return () => { delete document.documentElement.dataset.focusView; };
  }, []);

  const [expanded, setExpanded] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  /** Pushed to the end of today by hand. Gone tomorrow, so it is session state. */
  const [deferred, setDeferred] = useState<Set<string>>(new Set());
  /** Recomputed on the hour, so a task at 09:00 steps aside at 10:00. */
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // N and the phone bar both open the input; either way the cursor lands in it
  useEffect(() => {
    if (!quickOpen) return;
    const field = document.querySelector<HTMLInputElement>("[data-new-task-input]");
    field?.scrollIntoView({ block: "nearest" });
    field?.focus();
  }, [quickOpen]);

  const deferKey = `focusDeferred:${todayStr}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(deferKey);
      setDeferred(new Set<string>(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setDeferred(new Set());
    }
  }, [deferKey]);

  // The minute matters for the ordering, so keep it roughly current
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    };
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const defer = useCallback(
    (id: string) => {
      setDeferred((prev) => {
        const next = new Set(prev).add(id);
        try { sessionStorage.setItem(deferKey, JSON.stringify([...next])); } catch { /* ignore */ }
        return next;
      });
    },
    [deferKey]
  );

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  // ── What today is asking for ─────────────────────────────────────────
  const ordered = useMemo(
    () => orderFocusItems(collectFocusItems(todos, todayStr), nowMinutes, deferred),
    [todos, todayStr, nowMinutes, deferred]
  );
  const now = ordered[0] ?? null;
  const rest = useMemo(() => ordered.slice(1), [ordered]);
  const shown = expanded ? rest : rest.slice(0, VISIBLE_ROWS);

  // Progress counts everything today asked for, done or not
  const todayTotal = useMemo(
    () => todos.filter((x) => x.due_date === todayStr).length,
    [todos, todayStr]
  );
  const todayDone = useMemo(
    () => todos.filter((x) => x.due_date === todayStr && x.completed).length,
    [todos, todayStr]
  );

  const habitsDone = todaysHabits.filter((h) => h.completedToday).length;

  // ── The week beside it ───────────────────────────────────────────────
  const days = useMemo(() => weekDays(todayStr), [todayStr]);
  const weekHabits = useMemo(() => habitsForDates(days), [habitsForDates, days]);

  const weekRows = useMemo((): WeekDay[] => {
    return days.map((date) => {
      const dayTodos = todos.filter((x) => x.due_date === date);
      const openTodos = dayTodos.filter((x) => !x.completed);
      const dayHabits = weekHabits.filter((h) => h.date === date);
      const openHabits = dayHabits.filter((h) => !h.done);
      const titles = [
        ...openTodos.map((x) => x.title),
        ...dayHabits.map((h) => h.title),
      ];
      const total = dayTodos.length + dayHabits.length;
      const done = dayTodos.filter((x) => x.completed).length + dayHabits.filter((h) => h.done).length;
      return {
        date,
        isToday: date === todayStr,
        isPast: date < todayStr,
        openCount: openTodos.length + openHabits.length,
        doneCount: done,
        totalCount: total,
        titles: titles.slice(0, 2),
        more: Math.max(0, titles.length - 2),
      };
    });
  }, [days, todos, weekHabits, todayStr]);

  const weekOpen = weekRows.reduce((sum, day) => sum + day.openCount, 0);

  // ── Keyboard ─────────────────────────────────────────────────────────
  const rows = useMemo(
    () => [
      ...shown.map((item) => ({ kind: "todo" as const, id: item.todo.id })),
      ...todaysHabits.map((habit) => ({ kind: "habit" as const, id: habit.id })),
    ],
    [shown, todaysHabits]
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const handleDone = useCallback(() => {
    if (now) onToggleTodo(now.todo.id, true);
  }, [now, onToggleTodo]);

  const handleDefer = useCallback(() => {
    if (now) defer(now.todo.id);
  }, [now, defer]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      const overlay = document.querySelector('[aria-modal="true"], [role="dialog"]');

      if (e.key === "Escape") {
        if (typing || overlay) return;
        e.preventDefault();
        if (quickOpen) setQuickOpen(false);
        else onExit();
        return;
      }
      if (typing || overlay || e.metaKey || e.ctrlKey || e.altKey) return;

      const current = rowsRef.current;
      switch (e.key) {
        case "n":
          e.preventDefault();
          setQuickOpen(true);
          break;
        case "s":
          e.preventDefault();
          handleDefer();
          break;
        case "ArrowDown":
          if (current.length === 0) return;
          e.preventDefault();
          setCursor((prev) => (prev + 1 >= current.length ? 0 : prev + 1));
          break;
        case "ArrowUp":
          if (current.length === 0) return;
          e.preventDefault();
          setCursor((prev) => (prev <= 0 ? current.length - 1 : prev - 1));
          break;
        case " ": {
          const row = current[cursor];
          if (!row) return;
          e.preventDefault();
          if (row.kind === "todo") onToggleTodo(row.id, true);
          else onToggleHabit(row.id, todayStr);
          break;
        }
        case "Enter": {
          const row = current[cursor];
          if (!row || row.kind !== "todo") return;
          e.preventDefault();
          onOpenTask(row.id);
          break;
        }
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cursor, quickOpen, onExit, onToggleTodo, onToggleHabit, onOpenTask, handleDefer, todayStr]);

  // A shorter list must not leave the cursor pointing past the end
  useEffect(() => {
    setCursor((prev) => (prev >= rows.length ? rows.length - 1 : prev));
  }, [rows.length]);

  // ── Habit history, the seven dots behind each habit ──────────────────
  const historyOf = useCallback(
    (habit: HabitWithStatus): DayState[] => {
      const doneSet = new Set(
        habitCompletions
          .filter((c) => c.habit_id === habit.id)
          .map((c) => c.completed_date)
      );
      const out: DayState[] = [];
      const start = new Date(`${todayStr}T00:00:00`);
      for (let i = 6; i >= 0; i--) {
        const day = new Date(start);
        day.setDate(start.getDate() - i);
        const date = toDateStr(day);
        if (doneSet.has(date)) out.push("done");
        else if (!isScheduledForDate(habit, day)) out.push("off");
        else out.push(date === todayStr ? "open" : "missed");
      }
      return out;
    },
    [habitCompletions, todayStr]
  );

  const nothingAtAll = ordered.length === 0 && todaysHabits.length === 0 && todayTotal === 0;

  return (
    <>
      <div className="focus-view">
        <div className="focus-inner">
          <div className="focus-cols">
            {/* ── The day ───────────────────────────────────────────── */}
            <div className="focus-col">
              <p className="focus-eyebrow">{t("Today")}</p>
              <h1 className="focus-h1">{longDate(todayStr)}</h1>

              {todayTotal > 0 && (
                <div className="focus-progress">
                  {todayTotal <= 12 ? (
                    <span className="focus-segs">
                      {Array.from({ length: todayTotal }, (_, i) => (
                        <span key={i} className={`focus-seg ${i < todayDone ? "is-done" : ""}`} />
                      ))}
                    </span>
                  ) : (
                    <span className="focus-bar">
                      <span
                        className="focus-bar-fill"
                        style={{ width: `${Math.round((todayDone / todayTotal) * 100)}%` }}
                      />
                    </span>
                  )}
                  <span className="focus-progress-label">
                    {t("{done} of {total} done", { done: todayDone, total: todayTotal })}
                  </span>
                </div>
              )}

              {quickOpen ? (
                <div className="focus-quick">
                  <TodoInput
                    onAdd={async (title, tagIds, options) => {
                      const result = await onAddTodo(title, tagIds, {
                        ...options,
                        due_date: options?.due_date ?? todayStr,
                      });
                      return result;
                    }}
                    onCreateTag={onCreateTag}
                    tags={tags}
                    lists={lists}
                    events={events}
                    placeholder={t("Add a task for today")}
                  />
                </div>
              ) : (
                <button onClick={() => setQuickOpen(true)} className="focus-more focus-quick">
                  <Plus size={14} className="mr-1.5" />
                  {t("New task")}
                </button>
              )}

              {nothingAtAll ? (
                <div className="focus-now">
                  <p className="focus-now-label">
                    <span className="focus-now-dot" aria-hidden="true" />
                    {t("Now")}
                  </p>
                  <h2 className="focus-now-title">{t("Nothing planned")}</h2>
                  <p className="focus-now-meta">{t("Enjoy the day.")}</p>
                </div>
              ) : (
                <NowCard
                  item={now}
                  list={now?.todo.list_id ? listById.get(now.todo.list_id) : undefined}
                  next={rest[0]?.todo.title ?? null}
                  onDone={handleDone}
                  onDefer={handleDefer}
                  onTomorrow={() => { if (now) onUpdateTodo(now.todo.id, { due_date: getTomorrow() }); }}
                  onOpen={() => { if (now) onOpenTask(now.todo.id); }}
                />
              )}

              {rest.length > 0 && (
                <>
                  <div className="focus-section">
                    <span className="focus-eyebrow">{t("Later today")}</span>
                    <span className="focus-pill">{rest.length}</span>
                  </div>
                  {shown.map((item, i) => (
                    <FocusRow
                      key={item.todo.id}
                      item={item}
                      list={item.todo.list_id ? listById.get(item.todo.list_id) : undefined}
                      selected={cursor === i}
                      onToggle={() => onToggleTodo(item.todo.id, true)}
                      onOpen={() => onOpenTask(item.todo.id)}
                    />
                  ))}
                  {!expanded && rest.length > VISIBLE_ROWS && (
                    <button onClick={() => setExpanded(true)} className="focus-more">
                      {t("+ {n} more", { n: rest.length - VISIBLE_ROWS })}
                    </button>
                  )}
                </>
              )}

              {todaysHabits.length > 0 && (
                <>
                  <div className="focus-section">
                    <span className="focus-eyebrow">{t("Habits")}</span>
                    <span className="focus-pill">
                      {t("{done} of {total}", { done: habitsDone, total: todaysHabits.length })}
                    </span>
                  </div>
                  {todaysHabits.map((habit, i) => (
                    <FocusHabitRow
                      key={habit.id}
                      habit={habit}
                      history={historyOf(habit)}
                      selected={cursor === shown.length + i}
                      onToggle={() => onToggleHabit(habit.id, todayStr)}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="focus-divider" aria-hidden="true" />

            {/* ── The week ──────────────────────────────────────────── */}
            <div className="focus-col">
              <p className="focus-eyebrow">{t("This Week")}</p>
              <h2 className="focus-h1">
                {t("Week {n}", { n: isoWeekNumber(todayStr) })}
              </h2>
              <p className="focus-sub">
                {t("{from} to {to}", { from: dayOfMonth(days[0]), to: longDayAndMonth(days[6]) })}
                {" · "}
                {t("{n} open", { n: weekOpen })}
              </p>
              <WeekPanel days={weekRows} onSelectDay={onOpenDay} />
            </div>
          </div>

          <div className="focus-foot">
            <span className="focus-hint">
              <kbd className="focus-keycap">N</kbd>
              {t("New task")}
            </span>
            <span className="focus-hint">
              <kbd className="focus-keycap">{t("Space")}</kbd>
              {t("Mark as done")}
            </span>
            <span className="focus-hint">
              <kbd className="focus-keycap">S</kbd>
              {t("Later")}
            </span>
            <span className="flex-1" />
            <span className="focus-hint">
              {t("Open all tasks")}
              <kbd className="focus-keycap">{isMac() ? "⌘" : t("Ctrl")}</kbd>
              <kbd className="focus-keycap">⇧</kbd>
              <kbd className="focus-keycap">F</kbd>
            </span>
          </div>
        </div>
      </div>

      <div className="focus-mobilebar">
        <button onClick={() => setQuickOpen(true)} className="focus-btn-2">
          <Plus size={16} />
          {t("Task")}
        </button>
        <button onClick={onExit} className="focus-btn-2">
          <ListIcon size={16} />
          {t("All Tasks")}
        </button>
      </div>
    </>
  );
}

/** "Sonntag, 7. September" */
function longDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(formatLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "7." — the first half of "7. bis 13. September" */
function dayOfMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(formatLocale(), { day: "numeric" });
}

/** "13. September" */
function longDayAndMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(formatLocale(), {
    day: "numeric",
    month: "long",
  });
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
