import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  getOrCreateTodosCalendar,
  todoToCalendarEvent,
  habitToCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
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
  const { timeZone } = body;

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

  // Get or create the "Todos" calendar
  let calendarId = tokens.calendar_id;
  if (!calendarId) {
    calendarId = await getOrCreateTodosCalendar(accessToken);
    await supabase
      .from("google_tokens")
      .update({ calendar_id: calendarId })
      .eq("user_id", user.id);
  }

  let syncedTodos = 0;
  let syncedHabits = 0;

  try {
    // ─── Sync all todos with due dates ─────────────────────
    const { data: todos } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", user.id)
      .not("due_date", "is", null);

    if (todos) {
      // Get existing sync records
      const todoIds = todos.map((t) => t.id);
      const { data: existingSyncs } = await supabase
        .from("calendar_sync")
        .select("*")
        .in("todo_id", todoIds.length > 0 ? todoIds : ["__none__"]);

      const syncMap = new Map(
        (existingSyncs || []).map((s) => [s.todo_id, s])
      );

      // Fetch subtasks for all todos
      const { data: allSubtasks } = await supabase
        .from("subtasks")
        .select("*")
        .in("todo_id", todoIds.length > 0 ? todoIds : ["__none__"])
        .order("sort_order", { ascending: true });

      const subtaskMap = new Map<string, { title: string; completed: boolean }[]>();
      for (const st of allSubtasks || []) {
        if (!subtaskMap.has(st.todo_id)) subtaskMap.set(st.todo_id, []);
        subtaskMap.get(st.todo_id)!.push({ title: st.title, completed: st.completed });
      }

      // Fetch tags for all todos
      const { data: todoTags } = await supabase
        .from("todo_tags")
        .select("todo_id, tag_id")
        .in("todo_id", todoIds.length > 0 ? todoIds : ["__none__"]);

      const { data: allTags } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id);

      const tagNameMap = new Map((allTags || []).map((t) => [t.id, t.name]));
      const todoTagNamesMap = new Map<string, string[]>();
      for (const tt of todoTags || []) {
        if (!todoTagNamesMap.has(tt.todo_id)) todoTagNamesMap.set(tt.todo_id, []);
        const name = tagNameMap.get(tt.tag_id);
        if (name) todoTagNamesMap.get(tt.todo_id)!.push(name);
      }

      // Fetch lists for list_name resolution
      const { data: lists } = await supabase
        .from("lists")
        .select("id, name")
        .eq("user_id", user.id);

      const listNameMap = new Map((lists || []).map((l) => [l.id, l.name]));

      for (const todo of todos) {
        const event = todoToCalendarEvent({
          title: todo.title,
          due_date: todo.due_date,
          start_time: todo.start_time,
          end_time: todo.end_time,
          priority: todo.priority,
          notes: todo.notes,
          completed: todo.completed,
          subtasks: subtaskMap.get(todo.id),
          list_name: todo.list_id ? listNameMap.get(todo.list_id) : null,
          tag_names: todoTagNamesMap.get(todo.id),
          timeZone,
        });

        const existing = syncMap.get(todo.id);
        if (existing) {
          // Update existing event
          await updateCalendarEvent(
            accessToken,
            existing.google_event_id,
            event,
            calendarId
          );
        } else {
          // Create new event
          const created = await createCalendarEvent(accessToken, event, calendarId);
          if (created) {
            await supabase.from("calendar_sync").insert({
              todo_id: todo.id,
              user_id: user.id,
              google_event_id: created.id,
            });
          }
        }
        syncedTodos++;
      }
    }

    // ─── Sync all habits ───────────────────────────────────
    const { data: habits } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id);

    if (habits) {
      const habitIds = habits.map((h) => h.id);
      const { data: existingHabitSyncs } = await supabase
        .from("habit_calendar_sync")
        .select("*")
        .in("habit_id", habitIds.length > 0 ? habitIds : ["__none__"]);

      const habitSyncMap = new Map(
        (existingHabitSyncs || []).map((s) => [s.habit_id, s])
      );

      for (const habit of habits) {
        const event = habitToCalendarEvent({
          title: habit.title,
          schedule_type: habit.schedule_type,
          schedule_days: habit.schedule_days,
          schedule_interval: habit.schedule_interval || 1,
          created_at: habit.created_at,
          timeZone,
        });

        const existing = habitSyncMap.get(habit.id);
        if (existing) {
          await updateCalendarEvent(
            accessToken,
            existing.google_event_id,
            event,
            calendarId
          );
        } else {
          const created = await createCalendarEvent(accessToken, event, calendarId);
          if (created) {
            await supabase.from("habit_calendar_sync").insert({
              habit_id: habit.id,
              user_id: user.id,
              google_event_id: created.id,
            });
          }
        }
        syncedHabits++;
      }
    }

    return NextResponse.json({
      success: true,
      synced_todos: syncedTodos,
      synced_habits: syncedHabits,
    });
  } catch (err) {
    console.error("Bulk sync error:", err);
    return NextResponse.json(
      { error: "Bulk sync failed", success: false },
      { status: 500 }
    );
  }
}
