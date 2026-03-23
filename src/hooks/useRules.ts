"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Rule } from "@/lib/types";

export function useRules(userId: string | undefined) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRules = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("rules")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    setRules(data ?? []);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const addRule = useCallback(
    async (title: string, description?: string, category?: string) => {
      if (!userId) return;
      const maxOrder = rules.reduce((m, r) => Math.max(m, r.sort_order), -1);
      const { data, error } = await supabase
        .from("rules")
        .insert({
          user_id: userId,
          title,
          description: description || null,
          category: category || null,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      if (!error && data) setRules((prev) => [...prev, data]);
    },
    [userId, rules, supabase]
  );

  const updateRule = useCallback(
    async (id: string, updates: Partial<Pick<Rule, "title" | "description" | "category">>) => {
      if (!userId) return;
      const { error } = await supabase
        .from("rules")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (!error) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
        );
      }
    },
    [userId, supabase]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("rules")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (!error) setRules((prev) => prev.filter((r) => r.id !== id));
    },
    [userId, supabase]
  );

  const reorderRules = useCallback(
    async (reordered: Rule[]) => {
      setRules(reordered);
      const updates = reordered.map((r, i) => ({
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        sort_order: i,
      }));
      await supabase.from("rules").upsert(updates);
    },
    [supabase]
  );

  return { rules, loading, addRule, updateRule, deleteRule, reorderRules };
}
