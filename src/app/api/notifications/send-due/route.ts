import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import webpush from "web-push";

// Service-role client bypasses RLS — only used server-side in this cron route
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* Date and clock time in a given timezone */
function localParts(date: Date, timeZone: string): { date: string; hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
    };
  } catch {
    return {
      date: date.toISOString().slice(0, 10),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  }
}

export async function POST(request: NextRequest) {
  // Secure the endpoint — only Vercel cron (or manual testing) can call this
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Initialise VAPID inside handler so build-time env vars are not required
  const subject = process.env.VAPID_SUBJECT ?? "";
  webpush.setVapidDetails(
    subject.startsWith("mailto:") || subject.startsWith("https://") ? subject : `mailto:${subject || "admin@example.com"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  );

  const supabase = getAdminClient();

  const now = new Date();

  // Fetch all push subscriptions
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  // Group subscriptions by user_id
  const subsByUser: Record<string, typeof subscriptions> = {};
  for (const sub of subscriptions) {
    if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
    subsByUser[sub.user_id].push(sub);
  }

  const userIds = Object.keys(subsByUser);

  // Everyone's clock: reminders go out by the user's own local time, not UTC
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  const timezoneByUser: Record<string, string> = {};
  for (const profile of profiles ?? []) {
    const tz = (profile as { id: string; timezone?: string | null }).timezone;
    if (tz) timezoneByUser[(profile as { id: string }).id] = tz;
  }

  let totalSent = 0;

  for (const userId of userIds) {
    const userSubs = subsByUser[userId];
    const local = localParts(now, timezoneByUser[userId] ?? "UTC");
    const today = local.date;
    const nowTotalMins = local.hour * 60 + local.minute;
    // Wide morning window: the cron may only run once a day, and the
    // notification log makes sure each reminder still goes out only once
    const isMorningWindow = local.hour >= 6 && local.hour <= 11;
    const isAllDayWindow = isMorningWindow;
    const isOverdueWindow = isMorningWindow;

    // Fetch this user's incomplete todos
    const { data: todos } = await supabase
      .from("todos")
      .select("id, title, due_date, start_time")
      .eq("user_id", userId)
      .eq("completed", false);

    if (!todos) continue;

    type Notif = { todoId: string; type: string; title: string; body: string };
    const toSend: Notif[] = [];
    const todayTodos = todos.filter((t) => t.due_date === today);

    // ── Timed reminders ─────────────────────────────────────────────────────
    for (const todo of todayTodos) {
      if (!todo.start_time) continue;

      const [h, m] = todo.start_time.split(":").map(Number);
      const todoMins = h * 60 + m;
      const diff = todoMins - nowTotalMins;

      // At task time (0–5 min window)
      if (diff >= 0 && diff < 5) {
        toSend.push({
          todoId: todo.id,
          type: "at_time",
          title: todo.title,
          body: `Starting now at ${todo.start_time}`,
        });
      }
      // 15-minute early reminder (13–17 min window)
      else if (diff >= 13 && diff <= 17) {
        toSend.push({
          todoId: todo.id,
          type: "reminder_15",
          title: todo.title,
          body: `Due in ~15 minutes (${todo.start_time})`,
        });
      }
    }

    // ── All-day reminder, in the morning of the user's own day ───────────────
    if (isAllDayWindow) {
      for (const todo of todayTodos) {
        if (todo.start_time) continue; // timed todos handled above
        toSend.push({
          todoId: todo.id,
          type: "all_day",
          title: todo.title,
          body: "Due today",
        });
      }
    }

    // ── Overdue digest, once per local day ───────────────────────────────────
    if (isOverdueWindow) {
      const overdue = todos.filter((t) => t.due_date && t.due_date < today);
      if (overdue.length > 0) {
        const names = overdue.slice(0, 3).map((t) => t.title);
        toSend.push({
          todoId: `overdue-${today}`,
          type: "overdue",
          title:
            overdue.length === 1
              ? `"${overdue[0].title}" is overdue`
              : `${overdue.length} tasks are overdue`,
          body:
            overdue.length === 1
              ? "This task is past its due date"
              : names.join(", ") + (overdue.length > 3 ? "…" : ""),
        });
      }
    }

    // ── Send (with deduplication) ────────────────────────────────────────────
    for (const notif of toSend) {
      // Skip if already sent today
      const { data: existing } = await supabase
        .from("notification_log")
        .select("id")
        .eq("user_id", userId)
        .eq("reference_id", notif.todoId)
        .eq("notification_type", notif.type)
        .eq("sent_date", today)
        .maybeSingle();

      if (existing) continue;

      // Push to all user subscriptions
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: notif.title,
              body: notif.body,
              tag: `${notif.type}-${notif.todoId}`,
              url: "/dashboard",
            })
          );
          totalSent++;
        } catch (err: unknown) {
          // Remove expired/invalid subscriptions
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 410 || statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        }
      }

      // Record as sent
      await supabase.from("notification_log").insert({
        user_id: userId,
        reference_id: notif.todoId,
        notification_type: notif.type,
        sent_date: today,
      });
    }
  }

  return NextResponse.json({ success: true, sent: totalSent });
}

// Allow GET for easy manual testing in browser
export { POST as GET };
