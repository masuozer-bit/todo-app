"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Folder } from "@/lib/types";

export function useFolders(userId: string | undefined) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const supabase = createClient();

  const fetchFolders = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (data) setFolders(data);
  }, [userId]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const addFolder = useCallback(async (name: string) => {
    if (!userId) return;
    const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.sort_order)) : 0;
    const { data } = await supabase
      .from("folders")
      .insert({ user_id: userId, name, sort_order: maxOrder + 1 })
      .select()
      .single();
    if (data) setFolders(prev => [...prev, data]);
  }, [userId, folders]);

  const updateFolder = useCallback(async (id: string, name: string) => {
    await supabase.from("folders").update({ name }).eq("id", id);
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  }, []);

  const deleteFolder = useCallback(async (id: string, onListsUnassigned?: () => void) => {
    await supabase.from("folders").delete().eq("id", id);
    setFolders(prev => prev.filter(f => f.id !== id));
    // The DB ON DELETE SET NULL handles the lists — notify caller to re-sync local list state
    onListsUnassigned?.();
  }, []);

  return { folders, addFolder, updateFolder, deleteFolder };
}
