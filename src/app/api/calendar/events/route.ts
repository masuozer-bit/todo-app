import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  listCalendarEvents,
} from "@/lib/google-calendar";

/* Date and clock time of an instant in a given timezone */
function zonedParts(instant: Date, timeZone: string): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const hour = String(Number(get("hour")) % 24).padStart(2, "0");
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${hour}:${get("minute")}`,
    };
  } catch {
    return {
      date: instant.toISOString().slice(0, 10),
      time: instant.toISOString().slice(11, 16),
    };
  }
}

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
  // The server runs in UTC; the browser tells us which clock to read by
  const timeZone = searchParams.get("tz") || "UTC";

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
          const start = zonedParts(new Date(event.start.dateTime!), timeZone);
          date = start.date;
          startTime = start.time;
          if (event.end?.dateTime) {
            endTime = zonedParts(new Date(event.end.dateTime), timeZone).time;
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

    // Import external Google Calendar events as todos — batched, so a month
    // of events costs two requests instead of two per event
    let importedCount = 0;
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

      const newRows: Record<string, unknown>[] = [];
      const changed: typeof externalEvents = [];

      for (const ext of externalEvents) {
        const existing = existingMap.get(ext.google_event_id);
        if (!existing) {
          newRows.push({
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
          continue;
        }

        const needsUpdate =
          existing.title !== ext.title ||
          existing.due_date !== ext.date ||
          existing.start_time !== (ext.startTime ?? null) ||
          existing.end_time !== (ext.endTime ?? null) ||
          existing.notes !== (ext.description ?? null);

        if (needsUpdate) changed.push(ext);
      }

      if (newRows.length > 0) {
        const { error: insertError } = await supabase.from("todos").insert(newRows);
        if (!insertError) {
          importedCount += newRows.length;
        } else {
          // A parallel import may have written one of these rows already —
          // retry row by row so one duplicate does not drop the whole batch
          const results = await Promise.all(
            newRows.map((row) => supabase.from("todos").insert(row))
          );
          for (const result of results) {
            if (!result.error) importedCount++;
            else if (result.error.code !== "23505") {
              console.error("[calendar-import] Insert todo error:", JSON.stringify(result.error));
            }
          }
        }
      }

      if (changed.length > 0) {
        const results = await Promise.all(
          changed.map((ext) =>
            supabase
              .from("todos")
              .update({
                title: ext.title,
                due_date: ext.date,
                start_time: ext.startTime ?? null,
                end_time: ext.endTime ?? null,
                notes: ext.description ?? null,
              })
              .eq("user_id", user.id)
              .eq("google_event_id", ext.google_event_id)
          )
        );
        importedCount += results.filter((r) => !r.error).length;
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

    return NextResponse.json({ events, imported: importedCount });
  } catch (err) {
    console.error("Fetch calendar events error:", err);
    return NextResponse.json({ events: [] });
  }
}
