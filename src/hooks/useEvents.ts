"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Event, Todo, Tag } from "@/lib/types";

export function useEvents(userId: string | undefined, allTags: Tag[]) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchEvents = useCallback(async () => {
    if (!userId) return;

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !eventsData) {
      setLoading(false);
      return;
    }

    // Fetch todos for each event
    const eventIds = eventsData.map((e) => e.id);
    let todosMap: Record<string, Todo[]> = {};

    if (eventIds.length > 0) {
      const { data: todosData } = await supabase
        .from("todos")
        .select("*")
        .in("event_id", eventIds)
        .order("due_date", { ascending: true });

      if (todosData) {
        // Fetch tags for these todos
        const todoIds = todosData.map((t) => t.id);
        let todoTagsMap: Record<string, string[]> = {};

        if (todoIds.length > 0) {
          const { data: todoTagsData } = await supabase
            .from("todo_tags")
            .select("todo_id, tag_id")
            .in("todo_id", todoIds);

          if (todoTagsData) {
            todoTagsMap = todoTagsData.reduce(
              (acc, tt) => {
                if (!acc[tt.todo_id]) acc[tt.todo_id] = [];
                acc[tt.todo_id].push(tt.tag_id);
                return acc;
              },
              {} as Record<string, string[]>
            );
          }
        }

        todosMap = todosData.reduce(
          (acc, todo) => {
            if (!acc[todo.event_id]) acc[todo.event_id] = [];
            acc[todo.event_id].push({
              ...todo,
              priority: todo.priority ?? "none",
              tags: (todoTagsMap[todo.id] ?? [])
                .map((tagId) => allTags.find((t) => t.id === tagId))
                .filter(Boolean) as Tag[],
              subtasks: [],
            });
            return acc;
          },
          {} as Record<string, Todo[]>
        );
      }
    }

    const eventsWithTodos: Event[] = eventsData.map((event) => ({
      ...event,
      todos: todosMap[event.id] ?? [],
    }));

    setEvents(eventsWithTodos);
    setLoading(false);
  }, [userId, allTags]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addEvent = useCallback(
    async (title: string, options?: { description?: string; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null }) => {
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
        })
        .select()
        .single();

      if (error || !data) return;

      const newEvent: Event = { ...data, todos: [] };
      setEvents((prev) => [newEvent, ...prev]);
      return newEvent;
    },
    [userId]
  );

  const updateEvent = useCallback(
    async (id: string, updates: { title?: string; description?: string | null; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null }) => {
      const { error } = await supabase
        .from("events")
        .update(updates)
        .eq("id", id);

      if (!error) {
        setEvents((prev) =>
          prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
        );

        // When the event's list changes, apply it to all tasks in the event too
        if ("list_id" in updates) {
          await supabase
            .from("todos")
            .update({ list_id: updates.list_id })
            .eq("event_id", id);
        }
      }
    },
    []
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      // Delete all tasks belonging to this event, then delete the event itself
      await supabase.from("todos").delete().eq("event_id", id);
      const { error } = await supabase.from("events").delete().eq("id", id);

      if (!error) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    },
    []
  );

  const addTaskToEvent = useCallback(
    async (
      eventId: string,
      title: string,
      options?: {
        due_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        priority?: string;
        list_id?: string | null;
      }
    ) => {
      if (!userId) return;

      // Get event's list_id as default
      const event = events.find((e) => e.id === eventId);

      const { data, error } = await supabase
        .from("todos")
        .insert({
          user_id: userId,
          title,
          sort_order: 0,
          due_date: options?.due_date ?? null,
          start_time: options?.start_time ?? null,
          end_time: options?.end_time ?? null,
          priority: options?.priority ?? "none",
          list_id: options?.list_id ?? event?.list_id ?? null,
          event_id: eventId,
        })
        .select()
        .single();

      if (error || !data) return;

      const newTodo: Todo = {
        ...data,
        priority: data.priority ?? "none",
        tags: [],
        subtasks: [],
      };

      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, todos: [...(e.todos ?? []), newTodo] }
            : e
        )
      );
    },
    [userId, events]
  );

  const removeTaskFromEvent = useCallback(
    async (eventId: string, todoId: string) => {
      const { error } = await supabase
        .from("todos")
        .update({ event_id: null })
        .eq("id", todoId);

      if (!error) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, todos: (e.todos ?? []).filter((t) => t.id !== todoId) }
              : e
          )
        );
      }
    },
    []
  );

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    addTaskToEvent,
    removeTaskFromEvent,
    refetchEvents: fetchEvents,
  };
}
