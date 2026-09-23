import { toDateStr } from "./date-helpers";
import { isScheduledForDate } from "./habit-schedule";
import type { DayState, Habit, HabitTally } from "./types";

export type { DayState };

/** How far back streaks, rates and the history reach. The hook loads this much. */
export const HISTORY_DAYS = 365;

type Schedulable = Pick<Habit, "schedule_type" | "schedule_days" | "schedule_interval" | "created_at">;

/**
 * The first day that counts. Usually the day the habit was created, earlier
 * when someone ticked days before that to bring their history along.
 */
export function habitStart(habit: Schedulable, done: Set<string>): string {
  let start = toDateStr(new Date(habit.created_at));
  for (const ymd of done) if (ymd < start) start = ymd;
  return start;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function dayState(
  habit: Schedulable,
  date: Date,
  today: string,
  start: string,
  done: Set<string>,
  skipped: Set<string>
): DayState {
  const ymd = toDateStr(date);
  if (done.has(ymd)) return "done";
  if (ymd > today || ymd < start || !isScheduledForDate(habit, date)) return "rest";
  if (skipped.has(ymd)) return "skipped";
  return ymd === today ? "open" : "missed";
}

/**
 * Streaks and rates for one habit. Only due days count. A skipped day is a
 * rest: it neither breaks a run nor adds to it. Today only counts once it is
 * done, because until midnight it is not missed.
 */
export function habitStats(
  habit: Schedulable,
  done: Set<string>,
  skipped: Set<string>,
  now: Date = new Date()
): { streak: number; bestStreak: number; last7: HabitTally; last30: HabitTally; trail: DayState[] } {
  const todayDate = new Date(now);
  todayDate.setHours(0, 0, 0, 0);
  const today = toDateStr(todayDate);
  const start = habitStart(habit, done);

  // Oldest day first, so a run can grow and the best one is kept
  const states: DayState[] = [];
  // The trail shows every tick as it was, a bonus day included
  const trail: DayState[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = addDays(todayDate, -i);
    const state = dayState(habit, date, today, start, done, skipped);
    if (i < 7) trail.push(state);
    // Ticked on a day that was not due is a bonus, not part of a run
    states.push(state === "done" && !isScheduledForDate(habit, date) ? "rest" : state);
  }

  let run = 0;
  let bestStreak = 0;
  for (const state of states) {
    if (state === "done") {
      run++;
      if (run > bestStreak) bestStreak = run;
    } else if (state === "missed") {
      run = 0;
    }
  }

  const tally = (days: number): HabitTally => {
    const out = { done: 0, due: 0 };
    for (const state of states.slice(-days)) {
      if (state === "done") { out.done++; out.due++; }
      else if (state === "missed") out.due++;
    }
    return out;
  };

  return { streak: run, bestStreak, last7: tally(7), last30: tally(30), trail };
}

/** Several tallies as one, for a summary over all habits. */
export function sumTallies(tallies: HabitTally[]): HabitTally {
  return tallies.reduce((sum, t) => ({ done: sum.done + t.done, due: sum.due + t.due }), { done: 0, due: 0 });
}
