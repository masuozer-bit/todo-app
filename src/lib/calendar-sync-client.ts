type SyncAction = "create" | "update" | "delete" | "complete";

interface TodoSyncData {
  title: string;
  due_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  priority?: string;
  notes?: string | null;
  completed?: boolean;
  subtasks?: { title: string; completed: boolean }[];
  list_id?: string | null;
  list_name?: string | null;
  tag_names?: string[];
}

export async function syncTodoToCalendar(
  action: SyncAction,
  todoId: string,
  todoData?: TodoSyncData,
  googleEventId?: string | null
): Promise<void> {
  try {
    const response = await fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        todo_id: todoId,
        todo_data: todoData,
        google_event_id: googleEventId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      if (
        response.status === 400 &&
        data.error === "Google Calendar not connected"
      ) {
        return;
      }
      console.warn("Calendar sync failed:", data.error);
    }
  } catch {
    console.warn("Calendar sync network error");
  }
}

export async function syncHabitToCalendar(
  action: "create" | "update" | "delete",
  habitId: string,
  habitData?: {
    title: string;
    schedule_type: string;
    schedule_days: number[];
    schedule_interval: number;
    created_at: string;
  }
): Promise<void> {
  try {
    const response = await fetch("/api/calendar/habit-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        habit_id: habitId,
        habit_data: habitData,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      if (
        response.status === 400 &&
        data.error === "Google Calendar not connected"
      ) {
        return;
      }
      console.warn("Habit calendar sync failed:", data.error);
    }
  } catch {
    console.warn("Habit calendar sync network error");
  }
}

export async function getCalendarStatus(): Promise<{
  connected: boolean;
  hasCalendarScope: boolean;
}> {
  try {
    const response = await fetch("/api/calendar/status");
    if (!response.ok) return { connected: false, hasCalendarScope: false };
    return response.json();
  } catch {
    return { connected: false, hasCalendarScope: false };
  }
}

export async function disconnectCalendar(): Promise<boolean> {
  try {
    const response = await fetch("/api/calendar/disconnect", {
      method: "POST",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function bulkSyncCalendar(): Promise<{
  success: boolean;
  synced_todos?: number;
  synced_habits?: number;
  error?: string;
}> {
  try {
    const response = await fetch("/api/calendar/bulk-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    return response.json();
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function fetchCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<{
  events: {
    id: string;
    summary: string;
    description?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    isAllDay: boolean;
    htmlLink?: string;
    source: "google" | "synced";
  }[];
}> {
  try {
    const params = new URLSearchParams({ timeMin, timeMax });
    const response = await fetch(`/api/calendar/events?${params}`);
    if (!response.ok) return { events: [] };
    return response.json();
  } catch {
    return { events: [] };
  }
}
