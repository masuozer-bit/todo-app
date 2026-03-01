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

export function getEndOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
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

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
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

// Get the coming occurrence of a day name (including today if it matches)
function getThisDayOfWeek(dayIndex: number): string {
  const d = new Date();
  const current = d.getDay();
  let daysAhead = dayIndex - current;
  if (daysAhead < 0) daysAhead += 7;
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
  let recurrence_interval: number | null = null;

  // Extract tags: #tagname
  remaining = remaining.replace(/#(\w+)/g, (_, tag) => {
    tagNames.push(tag);
    return "";
  });

  // Extract priority: !high, !med, !medium, !low, !urgent (=high), !important (=high)
  remaining = remaining.replace(/!(high|med|medium|low|urgent|important|p1|p2|p3)/gi, (_, p) => {
    const pl = p.toLowerCase();
    if (pl === "high" || pl === "urgent" || pl === "important" || pl === "p1") priority = "high";
    else if (pl === "med" || pl === "medium" || pl === "p2") priority = "medium";
    else if (pl === "low" || pl === "p3") priority = "low";
    return "";
  });

  // Extract recurrence: "every day", "every week", "every month", "every year"
  // Also: "daily", "weekly", "monthly", "yearly"
  remaining = remaining.replace(/\bevery\s+(day|week|month|year)\b/gi, (_, unit) => {
    const u = unit.toLowerCase();
    if (u === "day") recurrence_type = "daily";
    else if (u === "week") recurrence_type = "weekly";
    else if (u === "month") recurrence_type = "monthly";
    else if (u === "year") recurrence_type = "yearly";
    recurrence_interval = 1;
    return "";
  });

  // "every N days/weeks/months/years"
  remaining = remaining.replace(/\bevery\s+(\d+)\s+(days?|weeks?|months?|years?)\b/gi, (_, n, unit) => {
    const num = parseInt(n, 10);
    const u = unit.toLowerCase().replace(/s$/, "");
    if (u === "day") recurrence_type = "daily";
    else if (u === "week") recurrence_type = "weekly";
    else if (u === "month") recurrence_type = "monthly";
    else if (u === "year") recurrence_type = "yearly";
    recurrence_interval = num;
    return "";
  });

  // Standalone: "daily", "weekly", "monthly", "yearly"
  remaining = remaining.replace(/\b(daily|weekly|monthly|yearly)\b/gi, (_, r) => {
    const rl = r.toLowerCase();
    if (rl === "daily") recurrence_type = "daily";
    else if (rl === "weekly") recurrence_type = "weekly";
    else if (rl === "monthly") recurrence_type = "monthly";
    else if (rl === "yearly") recurrence_type = "yearly";
    recurrence_interval = 1;
    return "";
  });

  // Extract time: "at 3pm", "at 15:00", "at 3:30pm"
  remaining = remaining.replace(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi, (_, t) => {
    const parsed = parseTimeString(t.trim());
    if (parsed) start_time = parsed;
    return "";
  });

  // Standalone time without "at": "3pm", "3:30pm" (only at word boundary)
  remaining = remaining.replace(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi, (match, t) => {
    if (start_time) return match; // already have a time
    const parsed = parseTimeString(t.trim());
    if (parsed) {
      start_time = parsed;
      return "";
    }
    return match;
  });

  // Extract date: "today", "tomorrow", "tonight"
  remaining = remaining.replace(/\btoday\b/gi, () => {
    due_date = getToday();
    return "";
  });

  remaining = remaining.replace(/\btomorrow\b/gi, () => {
    due_date = getTomorrow();
    return "";
  });

  remaining = remaining.replace(/\btonight\b/gi, () => {
    due_date = getToday();
    if (!start_time) start_time = "20:00";
    return "";
  });

  // "this morning", "this afternoon", "this evening"
  remaining = remaining.replace(/\bthis\s+(morning|afternoon|evening|night)\b/gi, (_, period) => {
    due_date = getToday();
    const pl = period.toLowerCase();
    if (pl === "morning" && !start_time) start_time = "09:00";
    else if (pl === "afternoon" && !start_time) start_time = "14:00";
    else if (pl === "evening" && !start_time) start_time = "18:00";
    else if (pl === "night" && !start_time) start_time = "20:00";
    return "";
  });

  // "next monday", "next friday", etc.
  remaining = remaining.replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi, (_, day) => {
    const dayIndex = DAY_NAMES[day.toLowerCase()];
    if (dayIndex !== undefined) {
      due_date = getNextDayOfWeek(dayIndex);
    }
    return "";
  });

  // "this monday", "this friday", etc. (current week occurrence)
  remaining = remaining.replace(/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi, (_, day) => {
    const dayIndex = DAY_NAMES[day.toLowerCase()];
    if (dayIndex !== undefined) {
      due_date = getThisDayOfWeek(dayIndex);
    }
    return "";
  });

  // Bare day names: "monday", "friday", etc. (next occurrence)
  remaining = remaining.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, (match) => {
    if (due_date) return match; // already have a date
    const dayIndex = DAY_NAMES[match.toLowerCase()];
    if (dayIndex !== undefined) {
      due_date = getThisDayOfWeek(dayIndex);
      return "";
    }
    return match;
  });

  // "next week", "next month", "next year"
  remaining = remaining.replace(/\bnext\s+week\b/gi, () => {
    due_date = getNextWeek();
    return "";
  });

  remaining = remaining.replace(/\bnext\s+month\b/gi, () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    due_date = toDateStr(d);
    return "";
  });

  remaining = remaining.replace(/\bnext\s+year\b/gi, () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    d.setMonth(0);
    d.setDate(1);
    due_date = toDateStr(d);
    return "";
  });

  // "in N days/weeks/months"
  remaining = remaining.replace(/\bin\s+(\d+)\s+(days?|weeks?|months?|years?)\b/gi, (_, n, unit) => {
    const num = parseInt(n, 10);
    const d = new Date();
    const u = unit.toLowerCase().replace(/s$/, "");
    if (u === "day") d.setDate(d.getDate() + num);
    else if (u === "week") d.setDate(d.getDate() + 7 * num);
    else if (u === "month") d.setMonth(d.getMonth() + num);
    else if (u === "year") d.setFullYear(d.getFullYear() + num);
    due_date = toDateStr(d);
    return "";
  });

  // "on Jan 15", "on March 3", "Jan 15", "March 3rd"
  const monthPattern = Object.keys(MONTH_NAMES).join("|");
  const onDateRe = new RegExp(
    `\\b(?:on\\s+)?(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
    "gi"
  );
  remaining = remaining.replace(onDateRe, (match, month, dayNum) => {
    if (due_date) return match;
    const monthIndex = MONTH_NAMES[month.toLowerCase()];
    if (monthIndex === undefined) return match;
    const day = parseInt(dayNum, 10);
    if (day < 1 || day > 31) return match;
    const d = new Date();
    d.setMonth(monthIndex);
    d.setDate(day);
    // If the date is in the past, move to next year
    if (d < new Date(new Date().setHours(0, 0, 0, 0))) {
      d.setFullYear(d.getFullYear() + 1);
    }
    due_date = toDateStr(d);
    return "";
  });

  // "on MM/DD" or "MM/DD"
  remaining = remaining.replace(/\b(?:on\s+)?(\d{1,2})\/(\d{1,2})\b/g, (match, m, d) => {
    if (due_date) return match;
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);
    if (month < 0 || month > 11 || day < 1 || day > 31) return match;
    const date = new Date();
    date.setMonth(month);
    date.setDate(day);
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
      date.setFullYear(date.getFullYear() + 1);
    }
    due_date = toDateStr(date);
    return "";
  });

  // "end of week", "eow"
  remaining = remaining.replace(/\b(?:end\s+of\s+week|eow)\b/gi, () => {
    due_date = getEndOfWeek();
    return "";
  });

  // "end of month", "eom"
  remaining = remaining.replace(/\b(?:end\s+of\s+month|eom)\b/gi, () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0); // last day of current month
    due_date = toDateStr(d);
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
    recurrence_interval: recurrence_type ? (recurrence_interval ?? 1) : null,
  };
}
