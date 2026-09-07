import type { Priority } from "./types";

/**
 * One priority palette. The same task must not be blue on the card, green in
 * the list and sky in the week planner.
 */
export const PRIORITY_META: Record<
  Priority,
  { label: string; dot: string; text: string }
> = {
  high:   { label: "High",   dot: "bg-red-500",    text: "text-red-500 dark:text-red-400" },
  medium: { label: "Medium", dot: "bg-amber-500",  text: "text-amber-500 dark:text-amber-400" },
  low:    { label: "Low",    dot: "bg-blue-500",   text: "text-blue-500 dark:text-blue-400" },
  none:   { label: "None",   dot: "bg-gray-300 dark:bg-gray-600", text: "text-gray-400" },
};
