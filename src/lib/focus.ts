import { toDateStr } from "./date-helpers";
import type { Priority, Todo } from "./types";

/**
 * The rules behind the focus view. They live here and not in the component
 * because "what do I do now" is the one question the view answers, and the
 * answer has to be the same for the big card and for the list under it.
 */

/** One task on one day: the due date, or an extra date that falls on today. */
export interface FocusItem {
  todo: Todo;
  /** The day this row stands for, YYYY-MM-DD. */
  date: string;
  /** The time to show, from the task or from its extra date. */
  time: string | null;
  overdue: boolean;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function minutesOfTime(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hours = Number(h);
  const minutes = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** Everything open that today has a claim on: due today, or overdue. */
export function collectFocusItems(todos: Todo[], todayStr: string): FocusItem[] {
  const out: FocusItem[] = [];
  for (const todo of todos) {
    if (todo.completed) continue;
    if (todo.due_date && todo.due_date <= todayStr) {
      out.push({
        todo,
        date: todo.due_date,
        time: todo.start_time ?? null,
        overdue: todo.due_date < todayStr,
      });
      continue;
    }
    // A task can carry extra dates; one of them may be today
    const extra = todo.extra_dates?.find((e) => e.date === todayStr && !e.completed);
    if (extra) {
      out.push({
        todo,
        date: todayStr,
        time: extra.time ?? todo.start_time ?? null,
        overdue: false,
      });
    }
  }
  return out;
}

/**
 * Four steps, in this order: what is late, what is due about now, what has no
 * time at all, and what had a time that has passed. A task at 09:00 stays the
 * answer until 10:00, then it steps aside for the untimed work.
 */
export function focusStage(item: FocusItem, nowMinutes: number): number {
  if (item.overdue) return 1;
  const t = minutesOfTime(item.time);
  if (t === null) return 3;
  return t >= nowMinutes - 60 ? 2 : 4;
}

/** The same order for the card and the list. Deferred tasks end their step. */
export function orderFocusItems(
  items: FocusItem[],
  nowMinutes: number,
  deferred: Set<string>
): FocusItem[] {
  return [...items].sort((a, b) => {
    const stageA = focusStage(a, nowMinutes);
    const stageB = focusStage(b, nowMinutes);
    if (stageA !== stageB) return stageA - stageB;

    const deferA = deferred.has(a.todo.id) ? 1 : 0;
    const deferB = deferred.has(b.todo.id) ? 1 : 0;
    if (deferA !== deferB) return deferA - deferB;

    if (stageA === 1) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.todo.sort_order - b.todo.sort_order;
    }
    if (stageA === 2 || stageA === 4) {
      const timeA = minutesOfTime(a.time) ?? 0;
      const timeB = minutesOfTime(b.time) ?? 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.todo.sort_order - b.todo.sort_order;
    }
    const prioA = PRIORITY_ORDER[a.todo.priority];
    const prioB = PRIORITY_ORDER[b.todo.priority];
    if (prioA !== prioB) return prioA - prioB;
    return a.todo.sort_order - b.todo.sort_order;
  });
}

/** Monday to Sunday of the week that holds this day. */
export function weekDays(todayStr: string): string[] {
  const start = new Date(`${todayStr}T00:00:00`);
  const weekday = start.getDay(); // 0 = Sunday
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateStr(d);
  });
}

/** ISO calendar week, the one people mean when they say "Woche 37". */
export function isoWeekNumber(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
