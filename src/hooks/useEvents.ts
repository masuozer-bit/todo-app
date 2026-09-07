"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { Event } from "@/lib/types";

/* Events only. Their tasks live in useTodos and are merged in on the dashboard,
   so the two never disagree and no extra requests are needed here. */
export function useEvents(userId: string | undefined) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { showError } = useToast();
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const fetchEvents = useCallback(async () => {
    if (!userId) return;

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error || !eventsData) {
      setLoading(false);
      return;
    }

    setEvents(eventsData);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addEvent = useCallback(
    async (title: string, options?: { description?: string; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null; start_time?: string | null; end_time?: string | null }) => {
      if (!userId) return;

      const { data, error } = await supabase
        .from("events")
        .insert({
          user_id: userId,
          title,
          description: options?.description ?? null,
          list_id: options?.list_id ?? null,
          color: options?.color ?? "#6366f1",
          due_date: options?.due_date ?? null,
          end_date: options?.end_date ?? null,
          start_time: options?.start_time ?? null,
          end_time: options?.end_time ?? null,
        })
        .select()
        .single();

      if (error || !data) {
        showError("Event could not be created");
        return;
      }

      const newEvent: Event = { ...data, todos: [] };
      setEvents((prev) => [newEvent, ...prev]);
      return newEvent;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, showError]
  );

  const updateEvent = useCallback(
    async (id: string, updates: { title?: string; description?: string | null; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null; start_time?: string | null; end_time?: string | null }) => {
      const previous = eventsRef.current;

      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      );

      const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", id);

      if (error) {
        setEvents(previous);
        showError("Event could not be saved");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const previous = eventsRef.current;

      setEvents((prev) => prev.filter((e) => e.id !== id));

      // The event's tasks are removed by the caller (useTodos) beforehand
      const { error } = await supabase.from("events").delete().eq("id", id);

      if (error) {
        setEvents(previous);
        showError("Event could not be deleted");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const reorderEvents = useCallback(
    async (orderedIds: string[]) => {
      const previous = eventsRef.current;
      // Optimistic update
      setEvents(prev => {
        const map = new Map(prev.map(e => [e.id, e]));
        return orderedIds
          .map((id, i) => {
            const e = map.get(id);
            return e ? { ...e, sort_order: i * 10 } : null;
          })
          .filter((e): e is Event => e !== null);
      });
      // Persist to DB
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from("events").update({ sort_order: i * 10 }).eq("id", id)
        )
      );
      const failed = results.filter(r => r.error);
      if (failed.length > 0) {
        setEvents(previous);
        showError("New order could not be saved");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    reorderEvents,
    refetchEvents: fetchEvents,
  };
}
