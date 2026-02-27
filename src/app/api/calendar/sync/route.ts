import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  getOrCreateTodosCalendar,
  todoToCalendarEvent,
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
  const { action, todo_id, todo_data, google_event_id, timeZone } = body;

  // Get user's Google tokens
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

  // Get a valid access token (refresh if needed)
  const accessToken = await getValidAccessToken(
    tokens,
    async (newAccessToken, newExpiresAt) => {
      await supabase
        .from("google_tokens")
        .update({
          access_token: newAccessToken,
          expires_at: newExpiresAt,
        })
        .eq("user_id", user.id);
    }
  );

  if (!accessToken) {
    await supabase.from("google_tokens").delete().eq("user_id", user.id);
    return NextResponse.json(
      { error: "Token expired, please reconnect Google Calendar" },
      { status: 401 }
    );
  }

  // Get or create the "Todos" calendar
  let calendarId = tokens.calendar_id;
  if (!calendarId) {
    calendarId = await getOrCreateTodosCalendar(accessToken);
    await supabase
      .from("google_tokens")
      .update({ calendar_id: calendarId })
      .eq("user_id", user.id);
  }

  // Look up existing sync record
  const { data: syncRecord } = await supabase
    .from("calendar_sync")
    .select("*")
    .eq("todo_id", todo_id)
    .single();

  try {
    switch (action) {
      case "create": {
        if (!todo_data?.due_date) break;
        const event = todoToCalendarEvent({ ...todo_data, timeZone });
        const created = await createCalendarEvent(accessToken, event, calendarId);
        if (created) {
          await supabase.from("calendar_sync").insert({
            todo_id,
            user_id: user.id,
            google_event_id: created.id,
          });
        }
        break;
      }

      case "update": {
        if (!todo_data?.due_date) {
          // due_date was removed — delete calendar event if it exists
          if (syncRecord) {
            await deleteCalendarEvent(accessToken, syncRecord.google_event_id, calendarId);
            await supabase
              .from("calendar_sync")
              .delete()
              .eq("todo_id", todo_id);
          }
          break;
        }

        const event = todoToCalendarEvent({ ...todo_data, timeZone });
        if (syncRecord) {
          await updateCalendarEvent(
            accessToken,
            syncRecord.google_event_id,
            event,
            calendarId
          );
          await supabase
            .from("calendar_sync")
            .update({ synced_at: new Date().toISOString() })
            .eq("todo_id", todo_id);
        } else {
          const created = await createCalendarEvent(accessToken, event, calendarId);
          if (created) {
            await supabase.from("calendar_sync").insert({
              todo_id,
              user_id: user.id,
              google_event_id: created.id,
            });
          }
        }
        break;
      }

      case "delete": {
        // Use passed google_event_id (sync record may be cascade-deleted already)
        const eventIdToDelete = google_event_id || syncRecord?.google_event_id;
        if (eventIdToDelete) {
          await deleteCalendarEvent(accessToken, eventIdToDelete, calendarId);
          // Clean up sync record if it still exists
          if (syncRecord) {
            await supabase
              .from("calendar_sync")
              .delete()
              .eq("todo_id", todo_id);
          }
        }
        break;
      }

      case "complete": {
        if (syncRecord && todo_data) {
          const event = todoToCalendarEvent({
            ...todo_data,
            completed: true,
            timeZone,
          });
          await updateCalendarEvent(
            accessToken,
            syncRecord.google_event_id,
            event,
            calendarId
          );
        }
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Calendar sync error:", err);
    return NextResponse.json(
      { error: "Calendar sync failed" },
      { status: 500 }
    );
  }
}
