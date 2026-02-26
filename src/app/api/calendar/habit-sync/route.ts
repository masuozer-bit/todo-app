import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  getOrCreateTodosCalendar,
  habitToCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, habit_id, habit_data, timeZone } = body;

  const { data: tokens } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!tokens) {
    return NextResponse.json(
      { error: "Google Calendar not connected" },
      { status: 400 }
    );
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
    await supabase.from("google_tokens").delete().eq("user_id", user.id);
    return NextResponse.json(
      { error: "Token expired, please reconnect" },
      { status: 401 }
    );
  }

  let calendarId = tokens.calendar_id;
  if (!calendarId) {
    calendarId = await getOrCreateTodosCalendar(accessToken);
    await supabase
      .from("google_tokens")
      .update({ calendar_id: calendarId })
      .eq("user_id", user.id);
  }

  // Look up existing habit sync record
  const { data: syncRecord } = await supabase
    .from("habit_calendar_sync")
    .select("*")
    .eq("habit_id", habit_id)
    .single();

  try {
    switch (action) {
      case "create": {
        if (!habit_data) break;
        const event = habitToCalendarEvent({ ...habit_data, timeZone });
        const created = await createCalendarEvent(accessToken, event, calendarId);
        if (created) {
          await supabase.from("habit_calendar_sync").insert({
            habit_id,
            user_id: user.id,
            google_event_id: created.id,
          });
        }
        break;
      }

      case "update": {
        if (!habit_data) break;
        const event = habitToCalendarEvent({ ...habit_data, timeZone });
        if (syncRecord) {
          // Delete old and create new (recurrence changes require new event)
          await deleteCalendarEvent(accessToken, syncRecord.google_event_id, calendarId);
          const created = await createCalendarEvent(accessToken, event, calendarId);
          if (created) {
            await supabase
              .from("habit_calendar_sync")
              .update({
                google_event_id: created.id,
                synced_at: new Date().toISOString(),
              })
              .eq("habit_id", habit_id);
          }
        } else {
          const created = await createCalendarEvent(accessToken, event, calendarId);
          if (created) {
            await supabase.from("habit_calendar_sync").insert({
              habit_id,
              user_id: user.id,
              google_event_id: created.id,
            });
          }
        }
        break;
      }

      case "delete": {
        if (syncRecord) {
          await deleteCalendarEvent(accessToken, syncRecord.google_event_id, calendarId);
          await supabase
            .from("habit_calendar_sync")
            .delete()
            .eq("habit_id", habit_id);
        }
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Habit calendar sync error:", err);
    return NextResponse.json(
      { error: "Habit calendar sync failed" },
      { status: 500 }
    );
  }
}
