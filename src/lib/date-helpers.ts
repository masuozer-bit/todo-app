import type { Priority, RecurrenceType } from "./types";

// ── Date formatting helpers ───────────────────────────────────────────
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getToday(): string {
  return toDateStr(new Date());
}

export function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

export function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return toDateStr(d);
}

export function getNextWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toDateStr(d);
}

// ── Recurrence: compute next due date ─────────────────────────────────
export function getNextDueDate(
  currentDueDate: string,
  recurrenceType: RecurrenceType,
  interval: number = 1
): string {
  const d = new Date(currentDueDate + "T00:00:00");

  switch (recurrenceType) {
    case "daily":
      d.setDate(d.getDate() + interval);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * interval);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + interval);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + interval);
      break;
  }

  return toDateStr(d);
}

export function formatRecurrence(
  type: RecurrenceType | null | undefined,
  interval: number | null | undefined
): string {
  if (!type) return "";
  const n = interval ?? 1;
  switch (type) {
    case "daily":
      return n === 1 ? "Daily" : `Every ${n} days`;
    case "weekly":
      return n === 1 ? "Weekly" : `Every ${n} weeks`;
    case "monthly":
      return n === 1 ? "Monthly" : `Every ${n} months`;
    case "yearly":
      return n === 1 ? "Yearly" : `Every ${n} years`;
  }
}

// ── Natural Language Parser ───────────────────────────────────────────
export interface ParsedTask {
  title: string;
  due_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  priority?: Priority;
  tagNames?: string[];
  recurrence_type?: RecurrenceType | null;
  recurrence_interval?: number | null;
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function parseTimeString(timeStr: string): string | null {
  // "3pm" → "15:00", "3:30pm" → "15:30", "15:00" → "15:00"
  const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toLowerCase();

  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getNextDayOfWeek(dayIndex: number): string {
  const d = new Date();
  const current = d.getDay();
  let daysAhead = dayIndex - current;
  if (daysAhead <= 0) daysAhead += 7;
  d.setDate(d.getDate() + daysAhead);
  return toDateStr(d);
}

export function parseNaturalLanguage(input: string): ParsedTask {
  let remaining = input;
  let due_date: string | null = null;
  let start_time: string | null = null;
  let priority: Priority = "none";
  const tagNames: string[] = [];
  let recurrence_type: RecurrenceType | null = null;

  // Extract tags: #tagname
  remaining = remaining.replace(/#(\w+)/g, (_, tag) => {
    tagNames.push(tag);
    return "";
  });

  // Extract priority: !high, !med, !medium, !low
  remaining = remaining.replace(/!(high|med|medium|low)/gi, (_, p) => {
    const pl = p.toLowerCase();
    if (pl === "high") priority = "high";
    else if (pl === "med" || pl === "medium") priority = "medium";
    else if (pl === "low") priority = "low";
    return "";
  });

  // Extract recurrence: "every day", "every week", "every month"
  remaining = remaining.replace(/\bevery\s+(day|week|month|year)\b/gi, (_, unit) => {
    const u = unit.toLowerCase();
    if (u === "day") recurrence_type = "daily";
    else if (u === "week") recurrence_type = "weekly";
    else if (u === "month") recurrence_type = "monthly";
    else if (u === "year") recurrence_type = "yearly";
    return "";
  });

  // Extract time: "at 3pm", "at 15:00", "at 3:30pm"
  remaining = remaining.replace(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi, (_, t) => {
    const parsed = parseTimeString(t.trim());
    if (parsed) start_time = parsed;
    return "";
  });

  // Extract date: "today", "tomorrow", "next monday", "next week"
  remaining = remaining.replace(/\btoday\b/gi, () => {
    due_date = getToday();
    return "";
  });

  remaining = remaining.replace(/\btomorrow\b/gi, () => {
    due_date = getTomorrow();
    return "";
  });

  remaining = remaining.replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi, (_, day) => {
    const dayIndex = DAY_NAMES[day.toLowerCase()];
    if (dayIndex !== undefined) {
      due_date = getNextDayOfWeek(dayIndex);
    }
    return "";
  });

  remaining = remaining.replace(/\bnext\s+week\b/gi, () => {
    due_date = getNextWeek();
    return "";
  });

  // If recurrence is set but no date, default to today
  if (recurrence_type && !due_date) {
    due_date = getToday();
  }

  // If time is set but no date, default to today
  if (start_time && !due_date) {
    due_date = getToday();
  }

  // Clean up remaining title
  const title = remaining.replace(/\s+/g, " ").trim();

  return {
    title,
    due_date,
    start_time,
    priority,
    tagNames,
    recurrence_type,
    recurrence_interval: recurrence_type ? 1 : null,
  };
}
