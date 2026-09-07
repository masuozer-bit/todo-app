/**
 * One place for dates and times, so the app does not mix 12h and 24h or
 * "Sep 6" and "6 Sep" from one card to the next.
 */

const DEFAULT_LOCALE = "en-GB";

/* "HH:MM" — 24 hours, the format the app stores anyway */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  if (h === undefined || m === undefined) return time;
  return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
}

/* "09:00–10:30", or just the start when there is no end */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start) return "";
  return end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start);
}

function toDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/* "6 Sep" */
export function formatShortDate(dateStr: string, locale: string = DEFAULT_LOCALE): string {
  const d = toDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/* "Sat, 6 Sep" */
export function formatDateWithWeekday(dateStr: string, locale: string = DEFAULT_LOCALE): string {
  const d = toDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/* "Today", "Tomorrow", "Yesterday", otherwise a short date */
export function formatRelativeDate(dateStr: string, locale: string = DEFAULT_LOCALE): string {
  const d = toDate(dateStr);
  if (!d) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatShortDate(dateStr, locale);
}
