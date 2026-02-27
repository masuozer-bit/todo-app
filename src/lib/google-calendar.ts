// Server-side only — do not import from client components

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  calendar_id?: string | null;
}

interface CalendarEvent {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  colorId?: string;
  status?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: { method: string; minutes: number }[];
  };
  recurrence?: string[];
}

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// Priority → Google Calendar color
const PRIORITY_COLOR_MAP: Record<string, string> = {
  high: "11",   // Tomato (red)
  medium: "5",  // Banana (yellow)
  low: "9",     // Blueberry (blue)
  none: "8",    // Graphite (gray)
};

// Colors for list/tag-based coloring (rotate through)
const LIST_TAG_COLORS = ["1", "2", "3", "4", "6", "7", "10"];
// 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 6=Tangerine, 7=Peacock, 10=Basil

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) return null;
  return response.json();
}

export async function getValidAccessToken(
  tokens: GoogleTokens,
  updateTokenCallback: (
    newAccessToken: string,
    newExpiresAt: string
  ) => Promise<void>
): Promise<string | null> {
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) return null;

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  if (!refreshed) return null;

  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();

  await updateTokenCallback(refreshed.access_token, newExpiresAt);
  return refreshed.access_token;
}

// ─── Separate "Todos" Calendar ───────────────────────────────

export async function getOrCreateTodosCalendar(
  accessToken: string
): Promise<string> {
  try {
    // List all calendars to find existing "Todos" calendar
    const listResponse = await fetch(
      `${CALENDAR_API_BASE}/users/me/calendarList`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (listResponse.ok) {
      const data = await listResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const todosCalendar = data.items?.find(
        (cal: any) => cal.summary === "Todos" && cal.accessRole === "owner"
      );
      if (todosCalendar) return todosCalendar.id;
    }

    // Create new "Todos" calendar
    const createResponse = await fetch(`${CALENDAR_API_BASE}/calendars`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: "Todos",
        description: "Tasks synced from Todo App",
      }),
    });

    if (createResponse.ok) {
      const cal = await createResponse.json();
      return cal.id;
    }
  } catch {
    // Fall through to primary
  }

  return "primary";
}

// ─── Event Building ──────────────────────────────────────────

function buildDescription(
  notes: string | null | undefined,
  subtasks?: { title: string; completed: boolean }[],
  listName?: string | null
): string {
  const parts: string[] = [];
  if (listName) parts.push(`📋 List: ${listName}`);
  if (notes) parts.push(notes);
  if (subtasks && subtasks.length > 0) {
    if (parts.length > 0) parts.push("");
    parts.push("Subtasks:");
    for (const st of subtasks) {
      parts.push(st.completed ? `  ☑ ${st.title}` : `  ☐ ${st.title}`);
    }
  }
  return parts.join("\n");
}

function determineColorId(
  priority?: string,
  listName?: string | null,
  tagNames?: string[]
): string {
  // Priority takes precedence if not "none"
  if (priority && priority !== "none") {
    return PRIORITY_COLOR_MAP[priority] || "8";
  }
  // Hash list name for consistent color
  if (listName) {
    const hash = [...listName].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return LIST_TAG_COLORS[hash % LIST_TAG_COLORS.length];
  }
  // Hash first tag name for consistent color
  if (tagNames && tagNames.length > 0) {
    const hash = [...tagNames[0]].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return LIST_TAG_COLORS[hash % LIST_TAG_COLORS.length];
  }
  return PRIORITY_COLOR_MAP["none"];
}

export function todoToCalendarEvent(todo: {
  title: string;
  due_date: string;
  start_time?: string | null;
  end_time?: string | null;
  priority?: string;
  notes?: string | null;
  completed?: boolean;
  subtasks?: { title: string; completed: boolean }[];
  list_name?: string | null;
  tag_names?: string[];
  timeZone?: string;
}): CalendarEvent {
  const description = buildDescription(todo.notes, todo.subtasks, todo.list_name);
  const colorId = determineColorId(todo.priority, todo.list_name, todo.tag_names);
  const tz = todo.timeZone || "UTC";

  let start: CalendarEvent["start"];
  let end: CalendarEvent["end"];
  let reminders: CalendarEvent["reminders"];

  if (todo.start_time) {
    // Time-based event
    start = { dateTime: `${todo.due_date}T${todo.start_time}:00`, timeZone: tz };
    if (todo.end_time) {
      end = { dateTime: `${todo.due_date}T${todo.end_time}:00`, timeZone: tz };
    } else {
      // Default 1 hour duration
      const [h, m] = todo.start_time.split(":").map(Number);
      const endH = (h + 1) % 24;
      const endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      end = { dateTime: `${todo.due_date}T${endTime}:00`, timeZone: tz };
    }
    reminders = {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "popup", minutes: 10 },
      ],
    };
  } else {
    // All-day event
    const startDate = todo.due_date;
    const endDateObj = new Date(startDate + "T00:00:00");
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDate = endDateObj.toISOString().split("T")[0];
    start = { date: startDate };
    end = { date: endDate };
    reminders = {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 0 }],
    };
  }

  // Completed todos get checkmark prefix + cancelled status
  const summary = todo.completed ? `✓ ${todo.title}` : todo.title;

  return {
    summary,
    description: description || undefined,
    start,
    end,
    colorId,
    status: todo.completed ? "cancelled" : "confirmed",
    reminders,
  };
}

export function habitToCalendarEvent(habit: {
  title: string;
  schedule_type: string;
  schedule_days: number[];
  schedule_interval: number;
  created_at: string;
  timeZone?: string;
}): CalendarEvent {
  // Build recurrence rule
  let rrule: string;
  if (habit.schedule_type === "weekly") {
    const dayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const days = habit.schedule_days.map((d) => dayMap[d]).join(",");
    rrule = `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
  } else {
    if (habit.schedule_interval <= 1) {
      rrule = "RRULE:FREQ=DAILY";
    } else {
      rrule = `RRULE:FREQ=DAILY;INTERVAL=${habit.schedule_interval}`;
    }
  }

  // All-day recurring event starting from today (not creation date, as that may be in the past)
  const today = new Date();
  const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const endDateObj = new Date(today);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;

  return {
    summary: `🔄 ${habit.title}`,
    description: "Habit tracked in Todo App",
    start: { date: startDate },
    end: { date: endDate },
    colorId: "2", // Sage (green-ish) for habits
    recurrence: [rrule],
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 0 }],
    },
  };
}

// ─── Calendar CRUD ───────────────────────────────────────────

export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent,
  calendarId: string = "primary"
): Promise<{ id: string } | null> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) return null;
  return response.json();
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: CalendarEvent,
  calendarId: string = "primary"
): Promise<boolean> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  return response.ok;
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
  calendarId: string = "primary"
): Promise<boolean> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 204 No Content = success, 410 Gone = already deleted
  return response.ok || response.status === 410;
}

// ─── Fetch Events (for displaying in app) ────────────────────

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{
  id: string;
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  colorId?: string;
  status?: string;
  htmlLink?: string;
}[]> {
  const params = new URLSearchParams({
    timeMin: new Date(timeMin + "T00:00:00").toISOString(),
    timeMax: new Date(timeMax + "T23:59:59").toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}
