import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
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
  const { action, todo_id, todo_data } = body;

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
    // Token refresh failed — clean up stale tokens
    await supabase.from("google_tokens").delete().eq("user_id", user.id);
    return NextResponse.json(
      { error: "Token expired, please reconnect Google Calendar" },
      { status: 401 }
    );
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
        const event = todoToCalendarEvent(todo_data);
        const created = await createCalendarEvent(accessToken, event);
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
            await deleteCalendarEvent(accessToken, syncRecord.google_event_id);
            await supabase
              .from("calendar_sync")
              .delete()
              .eq("todo_id", todo_id);
          }
          break;
        }

        const event = todoToCalendarEvent(todo_data);
        if (syncRecord) {
          await updateCalendarEvent(
            accessToken,
            syncRecord.google_event_id,
            event
          );
          await supabase
            .from("calendar_sync")
            .update({ synced_at: new Date().toISOString() })
            .eq("todo_id", todo_id);
        } else {
          // No event yet — create one
          const created = await createCalendarEvent(accessToken, event);
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
        if (syncRecord) {
          await deleteCalendarEvent(accessToken, syncRecord.google_event_id);
          await supabase
            .from("calendar_sync")
            .delete()
            .eq("todo_id", todo_id);
        }
        break;
      }

      case "complete": {
        if (syncRecord && todo_data) {
          const event = todoToCalendarEvent({
            ...todo_data,
            completed: true,
          });
          await updateCalendarEvent(
            accessToken,
            syncRecord.google_event_id,
            event
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
