type SyncAction = "create" | "update" | "delete" | "complete";

interface TodoSyncData {
  title: string;
  due_date?: string | null;
  priority?: string;
  notes?: string | null;
  completed?: boolean;
}

export async function syncTodoToCalendar(
  action: SyncAction,
  todoId: string,
  todoData?: TodoSyncData
): Promise<void> {
  try {
    const response = await fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        todo_id: todoId,
        todo_data: todoData,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      // Silently handle "not connected" — user hasn't enabled sync
      if (
        response.status === 400 &&
        data.error === "Google Calendar not connected"
      ) {
        return;
      }
      console.warn("Calendar sync failed:", data.error);
    }
  } catch {
    // Network error — don't break the main flow
    console.warn("Calendar sync network error");
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
