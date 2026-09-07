import type { Priority } from "./types";

/**
 * One priority palette. The same task must not be blue on the card, green in
 * the list and sky in the week planner.
 *
 * `bar` is the redesign's marker colour: a 3 by 16 px bar left of the title,
 * red for high, amber for medium, faint grey for low, nothing for none. It
 * reads from the tokens, so it follows the theme. `dot` and `text` are the
 * older Tailwind classes and go away with the last call site that uses them.
 */
export const PRIORITY_META: Record<
  Priority,
  { label: string; bar: string | null; dot: string; text: string }
> = {
  high:   { label: "High",   bar: "var(--danger)",     dot: "bg-red-500",    text: "text-red-500 dark:text-red-400" },
  medium: { label: "Medium", bar: "var(--warning)",    dot: "bg-amber-500",  text: "text-amber-500 dark:text-amber-400" },
  low:    { label: "Low",    bar: "var(--text-faint)", dot: "bg-blue-500",   text: "text-blue-500 dark:text-blue-400" },
  none:   { label: "None",   bar: null,                dot: "bg-gray-300 dark:bg-gray-600", text: "text-gray-400" },
};
