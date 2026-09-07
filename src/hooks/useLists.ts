"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { List } from "@/lib/types";
import { renameCalendar } from "@/lib/calendar-sync-client";

export function useLists(userId: string | undefined) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { showError } = useToast();
  const listsRef = useRef(lists);
  listsRef.current = lists;

  const fetchLists = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("lists")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (data) setLists(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const addList = useCallback(async (name: string, color?: string) => {
    if (!userId) return;
    const current = listsRef.current;
    const maxOrder = current.length > 0 ? Math.max(...current.map(l => l.sort_order)) : 0;
    const insert: Record<string, unknown> = { user_id: userId, name, sort_order: maxOrder + 1 };
    if (color) insert.color = color;

    const { data, error } = await supabase
      .from("lists")
      .insert(insert)
      .select().single();

    if (error || !data) {
      showError("List could not be created");
      return;
    }
    setLists(prev => [...prev, data]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, showError]);

  const updateList = useCallback(async (id: string, name: string, color?: string | null) => {
    const previous = listsRef.current;
    const update: Record<string, unknown> = { name };
    if (color !== undefined) update.color = color;

    setLists(prev => prev.map(l => l.id === id ? { ...l, name, ...(color !== undefined ? { color } : {}) } : l));

    const { error } = await supabase.from("lists").update(update).eq("id", id);
    if (error) {
      setLists(previous);
      showError("List could not be renamed");
      return;
    }

    // Rename the linked Google Calendar (fire-and-forget)
    const list = previous.find((l) => l.id === id);
    if (list?.google_calendar_id) {
      renameCalendar(list.google_calendar_id, name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  const updateListColor = useCallback(async (id: string, color: string | null) => {
    const previous = listsRef.current;
    setLists(prev => prev.map(l => l.id === id ? { ...l, color } : l));
    const { error } = await supabase.from("lists").update({ color }).eq("id", id);
    if (error) {
      setLists(previous);
      showError("Colour could not be saved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  const deleteList = useCallback(async (id: string) => {
    const previous = listsRef.current;
    const googleCalendarId = previous.find((l) => l.id === id)?.google_calendar_id ?? null;

    setLists(prev => prev.filter(l => l.id !== id));

    const { error } = await supabase.from("lists").delete().eq("id", id);
    if (error) {
      setLists(previous);
      showError("List could not be deleted");
      return;
    }

    // Delete the Google Calendar (fire-and-forget)
    if (googleCalendarId) {
      fetch("/api/calendar/delete-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_calendar_id: googleCalendarId }),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  const reorderLists = useCallback(async (reordered: List[]) => {
    const previous = listsRef.current;
    setLists(reordered);
    const updates = reordered.map((l, i) => ({
      id: l.id,
      user_id: l.user_id,
      name: l.name,
      sort_order: i,
      folder_id: l.folder_id ?? null,
    }));
    const { error } = await supabase.from("lists").upsert(updates);
    if (error) {
      setLists(previous);
      showError("New order could not be saved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  const moveListToFolder = useCallback(async (listId: string, folderId: string | null) => {
    const previous = listsRef.current;
    setLists(prev => prev.map(l => l.id === listId ? { ...l, folder_id: folderId } : l));
    const { error } = await supabase.from("lists").update({ folder_id: folderId }).eq("id", listId);
    if (error) {
      setLists(previous);
      showError("List could not be moved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError]);

  // Call after a folder is deleted to clear folder_id from affected lists in local state
  const unassignFolder = useCallback((folderId: string) => {
    setLists(prev => prev.map(l => l.folder_id === folderId ? { ...l, folder_id: null } : l));
  }, []);

  return { lists, loading, addList, updateList, updateListColor, deleteList, reorderLists, moveListToFolder, unassignFolder };
}
