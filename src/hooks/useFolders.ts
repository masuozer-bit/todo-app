"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { Folder } from "@/lib/types";

export function useFolders(userId: string | undefined) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const supabase = createClient();
  const { showError } = useToast();
  const foldersRef = useRef(folders);
  foldersRef.current = folders;

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
    const current = foldersRef.current;
    const maxOrder = current.length > 0 ? Math.max(...current.map(f => f.sort_order)) : 0;
    const { data, error } = await supabase
      .from("folders")
      .insert({ user_id: userId, name, sort_order: maxOrder + 1 })
      .select()
      .single();
    if (error || !data) {
      showError("Folder could not be created");
      return;
    }
    setFolders(prev => [...prev, data]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, showError]);

  const updateFolder = useCallback(async (id: string, name: string) => {
    const previous = foldersRef.current;
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    const { error } = await supabase.from("folders").update({ name }).eq("id", id);
    if (error) {
      setFolders(previous);
      showError("Folder could not be renamed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  const deleteFolder = useCallback(async (id: string, onListsUnassigned?: () => void) => {
    const previous = foldersRef.current;
    setFolders(prev => prev.filter(f => f.id !== id));
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) {
      setFolders(previous);
      showError("Folder could not be deleted");
      return;
    }
    // The DB ON DELETE SET NULL handles the lists — notify caller to re-sync local list state
    onListsUnassigned?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  return { folders, addFolder, updateFolder, deleteFolder };
}
