"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { List } from "@/lib/types";

export function useLists(userId: string | undefined) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchLists = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("lists")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (data) setLists(data);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const addList = useCallback(async (name: string) => {
    if (!userId) return;
    const maxOrder = lists.length > 0 ? Math.max(...lists.map(l => l.sort_order)) : 0;
    const { data } = await supabase
      .from("lists")
      .insert({ user_id: userId, name, sort_order: maxOrder + 1 })
      .select().single();
    if (data) setLists(prev => [...prev, data]);
  }, [userId, lists, supabase]);

  const updateList = useCallback(async (id: string, name: string) => {
    await supabase.from("lists").update({ name }).eq("id", id);
    setLists(prev => prev.map(l => l.id === id ? { ...l, name } : l));
  }, [supabase]);

  const deleteList = useCallback(async (id: string) => {
    await supabase.from("lists").delete().eq("id", id);
    setLists(prev => prev.filter(l => l.id !== id));
  }, [supabase]);

  const reorderLists = useCallback(async (reordered: List[]) => {
    setLists(reordered);
    const updates = reordered.map((l, i) => ({
      id: l.id,
      user_id: l.user_id,
      name: l.name,
      sort_order: i,
    }));
    await supabase.from("lists").upsert(updates);
  }, [supabase]);

  return { lists, loading, addList, updateList, deleteList, reorderLists };
}
