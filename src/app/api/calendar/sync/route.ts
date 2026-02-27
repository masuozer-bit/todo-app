import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  getOrCreateTodosCalendar,
  getOrCreateListCalendar,
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

  // Resolve which calendar this todo belongs to
  async function resolveCalendarId(listId?: string | null): Promise<string> {
    if (listId) {
      // Check if this list already has a calendar
      const { data: list } = await supabase
        .from("lists")
        .select("google_calendar_id, name")
        .eq("id", listId)
        .single();

      if (list?.google_calendar_id) return list.google_calendar_id;

      // Create a new calendar for this list
      if (list?.name) {
        const calId = await getOrCreateListCalendar(accessToken!, list.name);
        await supabase
          .from("lists")
          .update({ google_calendar_id: calId })
          .eq("id", listId);
        return calId;
      }
    }

    // Default: use the "Todos" calendar
    let calId = tokens!.calendar_id;
    if (!calId) {
      calId = await getOrCreateTodosCalendar(accessToken!);
      await supabase
        .from("google_tokens")
        .update({ calendar_id: calId })
        .eq("user_id", user!.id);
    }
    return calId;
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
        const calendarId = await resolveCalendarId(todo_data.list_id);
        const event = todoToCalendarEvent({ ...todo_data, timeZone });
        const created = await createCalendarEvent(accessToken, event, calendarId);
        if (created) {
          await supabase.from("calendar_sync").insert({
            todo_id,
            user_id: user.id,
            google_event_id: created.id,
            google_calendar_id: calendarId,
          });
        }
        break;
      }

      case "update": {
        if (!todo_data?.due_date) {
          // due_date was removed — delete calendar event if it exists
          if (syncRecord) {
            const delCalId = syncRecord.google_calendar_id || await resolveCalendarId(todo_data?.list_id);
            await deleteCalendarEvent(accessToken, syncRecord.google_event_id, delCalId);
            await supabase
              .from("calendar_sync")
              .delete()
              .eq("todo_id", todo_id);
          }
          break;
        }

        const targetCalendarId = await resolveCalendarId(todo_data.list_id);
        const event = todoToCalendarEvent({ ...todo_data, timeZone });

        if (syncRecord) {
          const oldCalendarId = syncRecord.google_calendar_id;

          if (oldCalendarId && oldCalendarId !== targetCalendarId) {
            // List changed → delete from old calendar, create in new
            await deleteCalendarEvent(accessToken, syncRecord.google_event_id, oldCalendarId);
            const created = await createCalendarEvent(accessToken, event, targetCalendarId);
            if (created) {
              await supabase
                .from("calendar_sync")
                .update({
                  google_event_id: created.id,
                  google_calendar_id: targetCalendarId,
                  synced_at: new Date().toISOString(),
                })
                .eq("todo_id", todo_id);
            }
          } else {
            // Same calendar → just update
            await updateCalendarEvent(
              accessToken,
              syncRecord.google_event_id,
              event,
              targetCalendarId
            );
            await supabase
              .from("calendar_sync")
              .update({
                google_calendar_id: targetCalendarId,
                synced_at: new Date().toISOString(),
              })
              .eq("todo_id", todo_id);
          }
        } else {
          const created = await createCalendarEvent(accessToken, event, targetCalendarId);
          if (created) {
            await supabase.from("calendar_sync").insert({
              todo_id,
              user_id: user.id,
              google_event_id: created.id,
              google_calendar_id: targetCalendarId,
            });
          }
        }
        break;
      }

      case "delete": {
        // Use passed google_event_id (sync record may be cascade-deleted already)
        const eventIdToDelete = google_event_id || syncRecord?.google_event_id;
        if (eventIdToDelete) {
          const delCalId = syncRecord?.google_calendar_id || await resolveCalendarId(todo_data?.list_id);
          await deleteCalendarEvent(accessToken, eventIdToDelete, delCalId);
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
          const calendarId = syncRecord.google_calendar_id || await resolveCalendarId(todo_data.list_id);
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
