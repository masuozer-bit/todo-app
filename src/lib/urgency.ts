import type { Todo } from "./types";

export type Urgency = "overdue" | "today" | "soon" | "normal";

/**
 * How urgent a task is, as one word. The redesign no longer paints urgency
 * badges: red means overdue, and nothing else carries a colour. What is left
 * here is the ranking the counts and the project heads sort by.
 */
export function urgencyOf(todo: Todo, todayStr: string, weekEndStr: string): Urgency {
  if (todo.completed || !todo.due_date) return "normal";
  if (todo.due_date < todayStr) return "overdue";
  if (todo.due_date === todayStr) return "today";
  if (todo.due_date <= weekEndStr) return "soon";
  return "normal";
}

export const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 3,
  today: 2,
  soon: 1,
  normal: 0,
};
