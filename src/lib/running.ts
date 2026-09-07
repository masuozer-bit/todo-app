import type { Todo } from "./types";

/**
 * "Running" is everything a person is currently in the middle of. Two things
 * put a task there, and either is enough:
 *
 *  1. Work has gone into it: the stopwatch is on it right now, or time has
 *     already been tracked against it.
 *  2. It has started but is not due yet: its start date has arrived and its
 *     due date has not.
 *
 * Completed tasks never count.
 */
export function isRunning(todo: Todo, todayStr: string, liveTaskId: string | null): boolean {
  if (todo.completed) return false;

  if (liveTaskId === todo.id) return true;
  if ((todo.time_spent ?? 0) > 0) return true;

  if (todo.start_date && todo.start_date <= todayStr) {
    if (!todo.due_date || todo.due_date > todayStr) return true;
  }
  return false;
}
