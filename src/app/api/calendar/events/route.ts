import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  listCalendarEvents,
} from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");

  if (!timeMin || !timeMax) {
    return NextResponse.json(
      { error: "timeMin and timeMax required" },
      { status: 400 }
    );
  }

  const { data: tokens } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokens) {
    return NextResponse.json({ events: [] });
  }

  const accessToken = await getValidAccessToken(
    tokens,
    async (newAccessToken, newExpiresAt) => {
      await supabase
        .from("google_tokens")
        .update({ access_token: newAccessToken, expires_at: newExpiresAt })
        .eq("user_id", user.id);
    }
  );

  if (!accessToken) {
    return NextResponse.json({ events: [] });
  }

  try {
    // Get our synced event IDs to distinguish synced vs external events
    const { data: syncRecords } = await supabase
      .from("calendar_sync")
      .select("google_event_id")
      .eq("user_id", user.id);

    const { data: habitSyncRecords } = await supabase
      .from("habit_calendar_sync")
      .select("google_event_id")
      .eq("user_id", user.id);

    const syncedEventIds = new Set([
      ...(syncRecords || []).map((r) => r.google_event_id),
      ...(habitSyncRecords || []).map((r) => r.google_event_id),
    ]);

    // Collect all calendar IDs to fetch from
    const calendarIds = new Set<string>(["primary"]);

    if (tokens.calendar_id) calendarIds.add(tokens.calendar_id);
    if (tokens.habits_calendar_id) calendarIds.add(tokens.habits_calendar_id);

    // Per-list calendars
    const { data: lists } = await supabase
      .from("lists")
      .select("google_calendar_id")
      .eq("user_id", user.id)
      .not("google_calendar_id", "is", null);

    for (const list of lists || []) {
      if (list.google_calendar_id) calendarIds.add(list.google_calendar_id);
    }

    // Fetch events from all calendars in parallel
    const allEventArrays = await Promise.all(
      [...calendarIds].map(async (calId) => {
        const events = await listCalendarEvents(accessToken, calId, timeMin, timeMax);
        return { calId, events };
      })
    );

    // Combine and deduplicate
    const allEventIds = new Set<string>();
    const events: {
      id: string;
      summary: string;
      description?: string;
      date: string;
      startTime?: string;
      endTime?: string;
      isAllDay: boolean;
      htmlLink?: string;
      source: "google" | "synced";
    }[] = [];

    // Collect external Google events for import
    const externalEvents: {
      google_event_id: string;
      title: string;
      description?: string;
      date: string;
      startTime?: string;
      endTime?: string;
    }[] = [];

    for (const { calId, events: calEvents } of allEventArrays) {
      for (const event of calEvents) {
        if (allEventIds.has(event.id)) continue;
        if (event.status === "cancelled") continue;
        allEventIds.add(event.id);

        const isAllDay = !!event.start?.date;
        let date: string;
        let startTime: string | undefined;
        let endTime: string | undefined;

        if (isAllDay) {
          date = event.start.date!;
        } else {
          const dt = new Date(event.start.dateTime!);
          date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          startTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
          if (event.end?.dateTime) {
            const endDt = new Date(event.end.dateTime);
            endTime = `${String(endDt.getHours()).padStart(2, "0")}:${String(endDt.getMinutes()).padStart(2, "0")}`;
          }
        }

        const isSynced = syncedEventIds.has(event.id);
        const source: "google" | "synced" = isSynced ? "synced" : "google";

        events.push({
          id: event.id,
          summary: event.summary || "(No title)",
          description: event.description,
          date,
          startTime,
          endTime,
          isAllDay,
          htmlLink: event.htmlLink,
          source,
        });

        // Collect external (non-synced) events for import
        if (source === "google") {
          externalEvents.push({
            google_event_id: event.id,
            title: event.summary || "(No title)",
            description: event.description,
            date,
            startTime,
            endTime,
          });
        }
      }
    }

    // Import external Google Calendar events as todos
    if (externalEvents.length > 0) {
      // Get already-imported google event IDs from todos table
      const { data: existingImports } = await supabase
        .from("todos")
        .select("google_event_id, title, due_date, start_time, end_time, notes")
        .eq("user_id", user.id)
        .not("google_event_id", "is", null);

      const existingMap = new Map(
        (existingImports || []).map((t) => [t.google_event_id, t])
      );

      for (const ext of externalEvents) {
        const existing = existingMap.get(ext.google_event_id);
        if (!existing) {
          // New — insert as todo
          const { error: insertError } = await supabase.from("todos").insert({
            user_id: user.id,
            title: ext.title,
            completed: false,
            sort_order: 0,
            due_date: ext.date,
            start_time: ext.startTime ?? null,
            end_time: ext.endTime ?? null,
            notes: ext.description ?? null,
            priority: "none",
            google_event_id: ext.google_event_id,
          });
          if (insertError && insertError.code !== "23505") {
            console.error("[calendar-import] Insert todo error:", JSON.stringify(insertError));
          }
        } else {
          // Update if changed
          const needsUpdate =
            existing.title !== ext.title ||
            existing.due_date !== ext.date ||
            existing.start_time !== (ext.startTime ?? null) ||
            existing.end_time !== (ext.endTime ?? null) ||
            existing.notes !== (ext.description ?? null);

          if (needsUpdate) {
            await supabase
              .from("todos")
              .update({
                title: ext.title,
                due_date: ext.date,
                start_time: ext.startTime ?? null,
                end_time: ext.endTime ?? null,
                notes: ext.description ?? null,
              })
              .eq("user_id", user.id)
              .eq("google_event_id", ext.google_event_id);
          }
        }
      }
    }

    // Sort by date then time
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return 0;
    });

    return NextResponse.json({ events, imported: true });
  } catch (err) {
    console.error("Fetch calendar events error:", err);
    return NextResponse.json({ events: [] });
  }
}
