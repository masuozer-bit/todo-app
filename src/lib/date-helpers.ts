import type { Priority } from "./types";

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

// ── Natural Language Parser ───────────────────────────────────────────
export interface ParsedTask {
  title: string;
  due_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  priority?: Priority;
  tagNames?: string[];
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  // German — both languages are understood at the same time, so a mixed
  // sentence like "Zahnarzt tomorrow um 10 Uhr" still parses
  sonntag: 0, so: 0,
  montag: 1, mo: 1,
  dienstag: 2, di: 2,
  mittwoch: 3, mi: 3,
  donnerstag: 4, "do": 4,
  freitag: 5, fr: 5,
  samstag: 6, sa: 6, sonnabend: 6,
};

/* After "nächsten"/"kommenden" the short forms are safe */
const GERMAN_DAY_PATTERN =
  "montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag|mo|di|mi|do|fr|sa|so";
/* On their own they are not: "Mail an Mo schreiben", "Do the laundry" */
const GERMAN_DAY_PATTERN_FULL =
  "montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag";

const MONTH_NAMES: Record<string, number> = {
  januar: 0, februar: 1, "märz": 2, maerz: 2, mai: 4, juni: 5, juli: 6,
  oktober: 9, dezember: 11,
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

/* "24.12." or "24.12.2026" — returns the input with the date removed */
function replaceGermanDate(input: string, onMatch: (date: string) => void): string {
  return input.replace(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})?(?![\d.])/g, (match, d, m, y) => {
    const day = parseInt(d, 10);
    const month = parseInt(m, 10) - 1;
    if (day < 1 || day > 31 || month < 0 || month > 11) return match;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    if (y) date.setFullYear(parseInt(y, 10));
    date.setMonth(month);
    date.setDate(day);
    if (!y && date < new Date(new Date().setHours(0, 0, 0, 0))) {
      date.setFullYear(date.getFullYear() + 1);
    }
    onMatch(toDateStr(date));
    return "";
  });
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
  let end_time: string | null = null;
  let priority: Priority = "none";
  const tagNames: string[] = [];

  // Extract tags: #tagname — letters of any language, so #Büro works
  remaining = remaining.replace(/#([\p{L}\p{N}_]+)/gu, (_, tag) => {
    tagNames.push(tag);
    return "";
  });

  // Extract priority: English and German markers
  remaining = remaining.replace(
    /!(high|med|medium|low|urgent|important|p1|p2|p3|hoch|mittel|niedrig|dringend|wichtig)/gi,
    (_, p) => {
      const pl = p.toLowerCase();
      if (["high", "urgent", "important", "p1", "hoch", "dringend", "wichtig"].includes(pl)) priority = "high";
      else if (["med", "medium", "p2", "mittel"].includes(pl)) priority = "medium";
      else if (["low", "p3", "niedrig"].includes(pl)) priority = "low";
      return "";
    }
  );


  // ── German patterns ──────────────────────────────────────────────────
  // Times: "um 15 Uhr", "15 Uhr", "um 15:30", "15.30 Uhr"
  remaining = remaining.replace(
    /\b(?:um\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/gi,
    (match, h, m) => {
      if (start_time) return match;
      const hours = parseInt(h, 10);
      const minutes = m ? parseInt(m, 10) : 0;
      if (hours > 23 || minutes > 59) return match;
      start_time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      return "";
    }
  );

  // "um 15:30" / "um 9" — bare hours between 1 and 6 mean the afternoon
  remaining = remaining.replace(/\bum\s+(\d{1,2})(?::(\d{2}))?\b/gi, (match, h, m) => {
    if (start_time) return match;
    let hours = parseInt(h, 10);
    const minutes = m ? parseInt(m, 10) : 0;
    if (hours > 23 || minutes > 59) return match;
    if (!m && hours >= 1 && hours <= 6) hours += 12;
    start_time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    return "";
  });

  remaining = remaining.replace(/(?<!\p{L})(heute|morgen|übermorgen|uebermorgen)(?!\p{L})/giu, (match, word) => {
    if (due_date) return match;
    const w = word.toLowerCase();
    const d = new Date();
    if (w === "morgen") d.setDate(d.getDate() + 1);
    else if (w === "übermorgen" || w === "uebermorgen") d.setDate(d.getDate() + 2);
    due_date = toDateStr(d);
    return "";
  });

  // "heute abend", "morgen früh" — the day is already gone by now, so this
  // only fills in a time
  remaining = remaining.replace(/\b(abends?|morgens|mittags|nachmittags|vormittags|nachts)\b/gi, (_, part) => {
    const p = part.toLowerCase();
    if (!start_time) {
      if (p.startsWith("abend")) start_time = "18:00";
      else if (p === "morgens" || p === "vormittags") start_time = "09:00";
      else if (p === "mittags") start_time = "12:00";
      else if (p === "nachmittags") start_time = "15:00";
      else if (p === "nachts") start_time = "21:00";
    }
    if (!due_date) due_date = getToday();
    return "";
  });

  remaining = remaining.replace(/(?<!\p{L})(?:früh|frueh)(?!\p{L})/giu, () => {
    if (!start_time) start_time = "08:00";
    return "";
  });

  // "nächsten Montag", "kommenden Freitag"
  remaining = remaining.replace(
    new RegExp(`(?<!\\p{L})(?:nächsten|naechsten|nächste|naechste|kommenden|kommende)\\s+(${GERMAN_DAY_PATTERN})(?!\\p{L})`, "giu"),
    (match, day) => {
      const dayIndex = DAY_NAMES[day.toLowerCase()];
      if (dayIndex === undefined) return match;
      due_date = getNextDayOfWeek(dayIndex);
      return "";
    }
  );

  remaining = remaining.replace(/(?<!\p{L})(?:nächste|naechste|kommende)\s+woche(?!\p{L})/giu, () => {
    due_date = getNextWeek();
    return "";
  });

  remaining = remaining.replace(/(?<!\p{L})(?:nächsten|naechsten|kommenden)\s+monat(?!\p{L})/giu, () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    due_date = toDateStr(d);
    return "";
  });

  // Bare German weekday: next occurrence
  remaining = remaining.replace(
    new RegExp(`(?<!\\p{L})(${GERMAN_DAY_PATTERN_FULL})(?!\\p{L})`, "giu"),
    (match, day) => {
      if (due_date) return match;
      const lower = day.toLowerCase();
      const dayIndex = DAY_NAMES[lower];
      if (dayIndex === undefined) return match;
      due_date = getThisDayOfWeek(dayIndex);
      return "";
    }
  );

  remaining = remaining.replace(/\bin\s+(\d+)\s+(tagen?|wochen?|monaten?|jahren?)\b/gi, (_, n, unit) => {
    const num = parseInt(n, 10);
    const d = new Date();
    const u = unit.toLowerCase();
    if (u.startsWith("tag")) d.setDate(d.getDate() + num);
    else if (u.startsWith("woche")) d.setDate(d.getDate() + 7 * num);
    else if (u.startsWith("monat")) d.setMonth(d.getMonth() + num);
    else if (u.startsWith("jahr")) d.setFullYear(d.getFullYear() + num);
    due_date = toDateStr(d);
    return "";
  });

  remaining = remaining.replace(/\bwochenende\b/gi, () => {
    if (due_date) return "";
    const d = new Date();
    const day = d.getDay();
    const untilSaturday = (6 - day + 7) % 7 || (day === 6 ? 0 : 7);
    d.setDate(d.getDate() + untilSaturday);
    due_date = toDateStr(d);
    return "";
  });

  remaining = remaining.replace(/\b(?:ende\s+der\s+woche|wochenende\s+ende)\b/gi, () => {
    due_date = getEndOfWeek();
    return "";
  });

  remaining = remaining.replace(/\bmonatsende\b|\bende\s+des\s+monats\b/gi, () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    due_date = toDateStr(d);
    return "";
  });

  // "24.12." and "24.12.2026"
  remaining = replaceGermanDate(remaining, (date) => { if (!due_date) due_date = date; });

  // Extract time range: "at 3pm-5pm", "from 3pm to 5pm", "3pm-5pm", "at 3:30pm-5pm"
  remaining = remaining.replace(
    /\b(?:(?:at|from)\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi,
    (match, t1, t2) => {
      const p1 = parseTimeString(t1.trim());
      const p2 = parseTimeString(t2.trim());
      if (p1 && p2) {
        start_time = p1;
        end_time = p2;
        return "";
      }
      return match;
    }
  );

  // Extract time: "at 3pm", "at 15:00", "at 3:30pm"
  remaining = remaining.replace(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi, (_, t) => {
    if (start_time) return ""; // already have a time from range parsing
    const raw = t.trim();
    const parsed = parseTimeString(raw);
    if (!parsed) return "";
    // "at 5" almost always means the afternoon, "at 9" the morning
    const bare = /^\d{1,2}$/.test(raw);
    const hour = parseInt(parsed.slice(0, 2), 10);
    start_time = bare && hour >= 1 && hour <= 6
      ? `${String(hour + 12).padStart(2, "0")}:00`
      : parsed;
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

  // If time is set but no date, default to today
  if (start_time && !due_date) {
    due_date = getToday();
  }

  // Clean up remaining title — remove the prepositions that belonged to the
  // date or time we just took out ("Sport am" → "Sport")
  const title = remaining
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s,]+(?:am|um|bis|für|fuer|im|in|von|ab|at|on|by|to)$/i, "")
    .trim();

  return {
    title,
    due_date,
    start_time,
    end_time,
    priority,
    tagNames,
  };
}
