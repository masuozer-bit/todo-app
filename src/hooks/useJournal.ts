"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JournalEntry } from "@/lib/types";

/**
 * One journal entry per day. The date is the key, so writing a day is an
 * upsert and never creates a second row for the same date.
 */
export function useJournal(userId: string | undefined) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  /**
   * Writes one day. Empty content deletes the row instead of leaving a blank
   * entry behind, so the calendar only marks days that hold something.
   */
  const saveEntry = useCallback(
    async (entryDate: string, content: string) => {
      if (!userId) return;
      const trimmed = content.trim();

      if (trimmed === "") {
        const existing = entries.find((e) => e.entry_date === entryDate);
        if (!existing) return;
        setEntries((prev) => prev.filter((e) => e.entry_date !== entryDate));
        const { error } = await supabase
          .from("journal_entries")
          .delete()
          .eq("id", existing.id)
          .eq("user_id", userId);
        if (error) fetchEntries();
        return;
      }

      // Optimistic: the editor should never wait for the roundtrip
      const now = new Date().toISOString();
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.entry_date === entryDate);
        if (idx === -1) {
          const draft: JournalEntry = {
            id: `temp-${entryDate}`,
            user_id: userId,
            entry_date: entryDate,
            content: trimmed,
            created_at: now,
            updated_at: now,
          };
          return [draft, ...prev].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
        }
        const next = [...prev];
        next[idx] = { ...next[idx], content: trimmed, updated_at: now };
        return next;
      });

      const { data, error } = await supabase
        .from("journal_entries")
        .upsert(
          { user_id: userId, entry_date: entryDate, content: trimmed, updated_at: now },
          { onConflict: "user_id,entry_date" }
        )
        .select()
        .single();

      if (error) {
        fetchEntries();
        return;
      }
      if (data) {
        setEntries((prev) => prev.map((e) => (e.entry_date === entryDate ? data : e)));
      }
    },
    [userId, entries, supabase, fetchEntries]
  );

  const entryFor = useCallback(
    (entryDate: string) => entries.find((e) => e.entry_date === entryDate) ?? null,
    [entries]
  );

  return { entries, loading, saveEntry, entryFor, refetchJournal: fetchEntries };
}
