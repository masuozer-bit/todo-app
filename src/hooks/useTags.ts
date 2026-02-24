"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tag } from "@/lib/types";

export function useTags(userId: string | undefined) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTags = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setTags(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const addTag = useCallback(
    async (name: string) => {
      if (!userId) return;

      const { data, error } = await supabase
        .from("tags")
        .insert({ user_id: userId, name })
        .select()
        .single();

      if (!error && data) {
        setTags((prev) => [...prev, data]);
      }
    },
    [userId]
  );

  const deleteTag = useCallback(
    async (id: string) => {
      if (!userId) return;

      const { error } = await supabase.from("tags").delete().eq("id", id);

      if (!error) {
        setTags((prev) => prev.filter((t) => t.id !== id));
      }
    },
    [userId]
  );

  return { tags, loading, addTag, deleteTag };
}
