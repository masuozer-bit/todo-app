// Server-side only — do not import from client components

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

interface CalendarEvent {
  summary: string;
  description?: string;
  start: { date: string };
  end: { date: string };
  colorId?: string;
  status?: string;
}

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// Map todo priority to Google Calendar colorId (1-11)
const PRIORITY_COLOR_MAP: Record<string, string> = {
  high: "11", // Tomato (red)
  medium: "5", // Banana (yellow)
  low: "9", // Blueberry (blue)
  none: "8", // Graphite (gray)
};

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
  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return tokens.access_token;
  }

  // Token expired or about to expire — refresh it
  if (!tokens.refresh_token) return null;

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  if (!refreshed) return null;

  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();

  await updateTokenCallback(refreshed.access_token, newExpiresAt);
  return refreshed.access_token;
}

export function todoToCalendarEvent(todo: {
  title: string;
  due_date: string;
  priority?: string;
  notes?: string | null;
  completed?: boolean;
}): CalendarEvent {
  // Google Calendar all-day events: end date is exclusive
  // A single-day event on 2024-01-15 needs end: 2024-01-16
  const startDate = todo.due_date;
  const endDateObj = new Date(startDate + "T00:00:00");
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDate = endDateObj.toISOString().split("T")[0];

  return {
    summary: todo.title,
    description: todo.notes || undefined,
    start: { date: startDate },
    end: { date: endDate },
    colorId: PRIORITY_COLOR_MAP[todo.priority ?? "none"],
    status: todo.completed ? "cancelled" : "confirmed",
  };
}

export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent
): Promise<{ id: string } | null> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events`,
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
  event: CalendarEvent
): Promise<boolean> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
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
  eventId: string
): Promise<boolean> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 204 No Content = success, 410 Gone = already deleted (also OK)
  return response.ok || response.status === 410;
}
