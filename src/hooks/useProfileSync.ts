"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the profile row in step with what the browser knows: the timezone
 * (so the reminder cron knows when 08:00 is for this user) and the chosen
 * language. Writes at most once per value and stays quiet if the columns
 * are not there yet.
 */
export function useProfileSync(userId: string | undefined, locale?: string) {
  useEffect(() => {
    if (!userId) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    const flag = `profileSync:${userId}:${timezone}:${locale ?? ""}`;
    try {
      if (localStorage.getItem(flag)) return;
    } catch { /* ignore */ }

    const supabase = createClient();
    const updates: Record<string, string> = { timezone };
    if (locale) updates.locale = locale;

    supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .then(({ error }) => {
        if (error) return; // column may not exist yet — not worth bothering anyone
        try { localStorage.setItem(flag, "1"); } catch { /* ignore */ }
      });
  }, [userId, locale]);
}
