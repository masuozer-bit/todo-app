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

  const log: string[] = [];

  try {
    // 1. Check google_event_id column exists on todos
    const { data: colCheck, error: colError } = await supabase
      .from("todos")
      .select("google_event_id")
      .eq("user_id", user.id)
      .limit(1);

    if (colError) {
      log.push(`❌ google_event_id column on todos error: ${JSON.stringify(colError)}`);
      return NextResponse.json({ log });
    }
    log.push(`✅ google_event_id column exists on todos`);

    // 2. Get tokens
    const { data: tokens } = await supabase
      .from("google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!tokens) {
      log.push(`❌ No google_tokens found`);
      return NextResponse.json({ log });
    }
    log.push(`✅ Google tokens found`);

    // 3. Get access token
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
      log.push(`❌ Could not get valid access token`);
      return NextResponse.json({ log });
    }
    log.push(`✅ Access token valid`);

    // 4. Get sync records
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
    log.push(`ℹ️ Synced event IDs (from app→google): ${syncedEventIds.size}`);

    // 5. Fetch from primary calendar
    const now = new Date();
    const timeMin = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    const timeMax = `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, "0")}-${String(endMonth.getDate()).padStart(2, "0")}`;

    log.push(`ℹ️ Fetching events from ${timeMin} to ${timeMax}`);

    const primaryEvents = await listCalendarEvents(accessToken, "primary", timeMin, timeMax);
    log.push(`ℹ️ Primary calendar returned ${primaryEvents.length} events`);

    for (const event of primaryEvents) {
      if (event.status === "cancelled") continue;
      const isSynced = syncedEventIds.has(event.id);
      const isAllDay = !!event.start?.date;
      let date = "";
      let startTime = "";
      let endTime = "";

      if (isAllDay) {
        date = event.start.date!;
      } else if (event.start?.dateTime) {
        const dt = new Date(event.start.dateTime);
        date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        startTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        if (event.end?.dateTime) {
          const endDt = new Date(event.end.dateTime);
          endTime = `${String(endDt.getHours()).padStart(2, "0")}:${String(endDt.getMinutes()).padStart(2, "0")}`;
        }
      }

      log.push(`  ${isSynced ? "🔗 SYNCED" : "🌐 EXTERNAL"}: "${event.summary}" on ${date} ${startTime}-${endTime}`);
    }

    // 6. Try importing one external event as a todo
    const externalEvents = primaryEvents.filter(e => e.status !== "cancelled" && !syncedEventIds.has(e.id));
    log.push(`ℹ️ External events to import as todos: ${externalEvents.length}`);

    if (externalEvents.length > 0) {
      const first = externalEvents[0];
      const isAllDay = !!first.start?.date;
      let date = "";
      let startTime: string | null = null;
      let endTime: string | null = null;

      if (isAllDay) {
        date = first.start.date!;
      } else if (first.start?.dateTime) {
        const dt = new Date(first.start.dateTime);
        date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        startTime = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        if (first.end?.dateTime) {
          const endDt = new Date(first.end.dateTime);
          endTime = `${String(endDt.getHours()).padStart(2, "0")}:${String(endDt.getMinutes()).padStart(2, "0")}`;
        }
      }

      log.push(`ℹ️ Attempting to insert todo: "${first.summary}" (${date} ${startTime}-${endTime})`);

      const { data: insertData, error: insertError } = await supabase
        .from("todos")
        .insert({
          user_id: user.id,
          title: first.summary || "(No title)",
          completed: false,
          sort_order: 0,
          due_date: date,
          start_time: startTime,
          end_time: endTime,
          notes: first.description ?? null,
          priority: "none",
          google_event_id: first.id,
        })
        .select()
        .single();

      if (insertError) {
        log.push(`❌ Insert todo failed: ${JSON.stringify(insertError)}`);
      } else {
        log.push(`✅ Insert succeeded! Todo ID: ${insertData?.id}`);
      }
    }

    // 7. Check existing imported todos
    const { data: imported } = await supabase
      .from("todos")
      .select("id, title, google_event_id, due_date, start_time, end_time")
      .eq("user_id", user.id)
      .not("google_event_id", "is", null);

    log.push(`ℹ️ Already imported todos in DB: ${(imported || []).length}`);
    for (const t of imported || []) {
      log.push(`  📦 "${t.title}" due ${t.due_date} ${t.start_time || ""}-${t.end_time || ""}`);
    }

    return NextResponse.json({ log });
  } catch (err) {
    log.push(`❌ Exception: ${String(err)}`);
    return NextResponse.json({ log });
  }
}
