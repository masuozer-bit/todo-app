"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { Tag } from "@/lib/types";

export function useTags(userId: string | undefined) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { showError } = useToast();
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

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

  /* Returns the tag so callers can attach it to a task right away */
  const addTag = useCallback(
    async (name: string): Promise<Tag | undefined> => {
      if (!userId) return;
      const trimmed = name.trim();
      if (!trimmed) return;

      // Never create the same tag twice
      const existing = tagsRef.current.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) return existing;

      const { data, error } = await supabase
        .from("tags")
        .insert({ user_id: userId, name: trimmed })
        .select()
        .single();

      if (error || !data) {
        showError("Tag could not be created");
        return;
      }

      setTags((prev) => [...prev, data]);
      return data as Tag;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, showError]
  );

  const deleteTag = useCallback(
    async (id: string) => {
      if (!userId) return;
      const previous = tagsRef.current;

      setTags((prev) => prev.filter((t) => t.id !== id));

      const { error } = await supabase.from("tags").delete().eq("id", id);

      if (error) {
        setTags(previous);
        showError("Tag could not be deleted");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, showError]
  );

  return { tags, loading, addTag, deleteTag };
}
