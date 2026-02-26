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
    // Fetch from primary calendar (user's main schedule)
    const primaryEvents = await listCalendarEvents(
      accessToken,
      "primary",
      timeMin,
      timeMax
    );

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

    // Also fetch from our Todos calendar if it exists
    const todosCalendarId = tokens.calendar_id;
    let todosEvents: typeof primaryEvents = [];
    if (todosCalendarId && todosCalendarId !== "primary") {
      todosEvents = await listCalendarEvents(
        accessToken,
        todosCalendarId,
        timeMin,
        timeMax
      );
    }

    // Combine and deduplicate, marking source
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

    const processEvent = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: any,
      defaultSource: "google" | "synced"
    ) => {
      if (allEventIds.has(event.id)) return;
      if (event.status === "cancelled") return;
      allEventIds.add(event.id);

      const isAllDay = !!event.start?.date;
      let date: string;
      let startTime: string | undefined;
      let endTime: string | undefined;

      if (isAllDay) {
        date = event.start.date;
      } else {
        const dt = new Date(event.start.dateTime);
        date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        startTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        if (event.end?.dateTime) {
          const endDt = new Date(event.end.dateTime);
          endTime = `${String(endDt.getHours()).padStart(2, "0")}:${String(endDt.getMinutes()).padStart(2, "0")}`;
        }
      }

      const source = syncedEventIds.has(event.id) ? "synced" : defaultSource;

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
    };

    for (const event of primaryEvents) {
      processEvent(event, "google");
    }
    for (const event of todosEvents) {
      processEvent(event, "synced");
    }

    // Sort by date then time
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return 0;
    });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Fetch calendar events error:", err);
    return NextResponse.json({ events: [] });
  }
}
