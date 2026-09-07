import type { Habit } from "./types";

/**
 * Is a habit due on this date? One definition, used by the list, the week
 * modal, the planner and the hook, so they cannot drift apart.
 */
export function isScheduledForDate(
  habit: Pick<Habit, "schedule_type" | "schedule_days" | "schedule_interval" | "created_at"> & {
    start_date?: string | null;
  },
  date: Date
): boolean {
  if (habit.schedule_type === "weekly") {
    return habit.schedule_days.includes(date.getDay());
  }

  const interval = habit.schedule_interval || 1;
  if (interval === 1) return true; // every day

  // Interval habits count from an explicit start date when there is one,
  // otherwise from the day the habit was created
  const start = habit.start_date
    ? new Date(`${habit.start_date}T00:00:00`)
    : new Date(habit.created_at);
  start.setHours(0, 0, 0, 0);

  const check = new Date(date);
  check.setHours(0, 0, 0, 0);

  const diffDays = Math.round((check.getTime() - start.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays % interval === 0;
}
