"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Todo, Tag, Subtask, Priority, List } from "@/lib/types";
import { syncTodoToCalendar } from "@/lib/calendar-sync-client";

/* Todos as they live in state: tags are stored as IDs and resolved on render,
   so loading the tag list never forces a second todo fetch. */
type RawTodo = Omit<Todo, "tags"> & { tag_ids: string[] };

export function useTodos(
  userId: string | undefined,
  allTags: Tag[],
  activeListId?: string | null,
  allLists?: List[]
) {
  const [rawTodos, setRawTodos] = useState<RawTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const rawTodosRef = useRef(rawTodos);
  rawTodosRef.current = rawTodos;
  const listsRef = useRef(allLists);
  listsRef.current = allLists;

  // Resolve tag IDs to tag objects for consumers
  const todos: Todo[] = useMemo(() => {
    const tagsById = new Map(allTags.map((t) => [t.id, t]));
    return rawTodos.map(({ tag_ids, ...todo }) => ({
      ...todo,
      tags: tag_ids
        .map((id) => tagsById.get(id))
        .filter(Boolean) as Tag[],
    }));
  }, [rawTodos, allTags]);

  const todosRef = useRef(todos);
  todosRef.current = todos;

  // Helper to resolve list_id → list_name (uses ref so it's always fresh)
  function getListName(listId?: string | null): string | null {
    if (!listId || !listsRef.current) return null;
    return listsRef.current.find((l) => l.id === listId)?.name ?? null;
  }

  const fetchTodos = useCallback(async () => {
    if (!userId) return;

    // Fetch ALL todos with their tags and subtasks in a single request —
    // filtering by list is done client-side in the dashboard so the full set
    // is available for per-list counts and quick filters
    const { data, error } = await supabase
      .from("todos")
      .select("*, todo_tags(tag_id), subtasks(*)")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("sort_order", { referencedTable: "subtasks", ascending: true });

    if (error || !data) {
      setLoading(false);
      return;
    }

    setRawTodos(
      data.map((row) => {
        const { todo_tags, subtasks, ...todo } = row as Record<string, unknown> & {
          todo_tags?: { tag_id: string }[];
          subtasks?: Subtask[];
        };
        return {
          ...(todo as unknown as Omit<Todo, "tags" | "subtasks">),
          priority: ((todo as { priority?: Priority }).priority ?? "none") as Priority,
          tag_ids: (todo_tags ?? []).map((tt) => tt.tag_id),
          subtasks: subtasks ?? [],
        };
      })
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(
    async (
      title: string,
      tagIds: string[],
      options?: {
        due_date?: string | null;
        start_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        priority?: Priority;
        notes?: string | null;
        list_id?: string | null;
        event_id?: string | null;
      }
    ) => {
      if (!userId) return;

      const current = rawTodosRef.current;
      const maxOrder =
        current.length > 0 ? Math.max(...current.map((t) => t.sort_order)) : 0;

      const { data: todoData, error } = await supabase
        .from("todos")
        .insert({
          user_id: userId,
          title,
          sort_order: maxOrder + 1,
          due_date: options?.due_date ?? null,
          start_date: options?.start_date ?? null,
          start_time: options?.start_time ?? null,
          end_time: options?.end_time ?? null,
          priority: options?.priority ?? "none",
          notes: options?.notes ?? null,
          list_id: options !== undefined && "list_id" in options ? options.list_id : (activeListId ?? null),
          event_id: options?.event_id ?? null,
        })
        .select()
        .single();

      if (error || !todoData) return;

      if (tagIds.length > 0) {
        await supabase
          .from("todo_tags")
          .insert(tagIds.map((tagId) => ({ todo_id: todoData.id, tag_id: tagId })));
      }

      const newTodo: RawTodo = {
        ...todoData,
        priority: todoData.priority ?? "none",
        tag_ids: tagIds,
        subtasks: [],
      };

      setRawTodos((prev) => [...prev, newTodo]);

      // Return new todo ID so callers can attach subtasks
      const createdId: string = todoData.id;

      // Calendar sync (fire-and-forget)
      if (options?.due_date) {
        const tagNames = tagIds
          .map((id) => allTags.find((t) => t.id === id)?.name)
          .filter(Boolean) as string[];
        syncTodoToCalendar("create", todoData.id, {
          title,
          due_date: options.due_date,
          start_date: options.start_date,
          start_time: options.start_time,
          end_time: options.end_time,
          priority: options.priority,
          notes: options.notes,
          completed: false,
          subtasks: [],
          tag_names: tagNames,
          list_id: options.list_id ?? activeListId,
          list_name: getListName(options.list_id ?? activeListId),
        });
      }

      return createdId;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, allTags, activeListId]
  );

  const toggleTodo = useCallback(
    async (id: string, completed: boolean) => {
      const todo = todosRef.current.find((t) => t.id === id);

      const { error } = await supabase
        .from("todos")
        .update({ completed })
        .eq("id", id);

      if (!error) {
        setRawTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, completed } : t))
        );

        // Calendar sync (fire-and-forget) — skip for Google-imported todos
        if (todo?.due_date && !todo.google_event_id) {
          syncTodoToCalendar("complete", id, {
            title: todo.title,
            due_date: todo.due_date,
            start_date: todo.start_date,
            start_time: todo.start_time,
            end_time: todo.end_time,
            priority: todo.priority,
            notes: todo.notes,
            completed,
            subtasks: (todo.subtasks ?? []).map((s) => ({
              title: s.title,
              completed: s.completed,
            })),
            tag_names: (todo.tags ?? []).map((t) => t.name),
            list_id: todo.list_id,
            list_name: getListName(todo.list_id),
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const updateTodo = useCallback(
    async (
      id: string,
      updates: {
        title?: string;
        due_date?: string | null;
        start_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        priority?: Priority;
        notes?: string | null;
        list_id?: string | null;
        time_spent?: number | null;
        estimated_time?: number | null;
        extra_dates?: { date: string; time?: string | null; completed: boolean }[] | null;
      }
    ) => {
      const { error } = await supabase
        .from("todos")
        .update(updates)
        .eq("id", id);

      if (error) return;

      setRawTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );

      // Calendar sync (fire-and-forget) — skip for Google-imported todos
      const existingTodo = todosRef.current.find((t) => t.id === id);
      if (existingTodo && !existingTodo.google_event_id) {
        const merged = { ...existingTodo, ...updates };
        if (merged.due_date || existingTodo.due_date) {
          syncTodoToCalendar("update", id, {
            title: merged.title,
            due_date: merged.due_date,
            start_date: merged.start_date,
            start_time: merged.start_time,
            end_time: merged.end_time,
            priority: merged.priority,
            notes: merged.notes,
            completed: merged.completed,
            subtasks: (merged.subtasks ?? []).map((s) => ({
              title: s.title,
              completed: s.completed,
            })),
            tag_names: (merged.tags ?? []).map((t) => t.name),
            list_id: merged.list_id ?? existingTodo.list_id,
            list_name: getListName(merged.list_id ?? existingTodo.list_id),
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      // Capture todo data before deletion for calendar sync
      const todo = todosRef.current.find((t) => t.id === id);

      // Fetch sync record BEFORE deleting (cascade will remove it)
      let googleEventId: string | null = null;
      let googleCalendarId: string | null = null;
      if (todo?.due_date) {
        const { data: syncRecord } = await supabase
          .from("calendar_sync")
          .select("google_event_id, google_calendar_id")
          .eq("todo_id", id)
          .single();
        googleEventId = syncRecord?.google_event_id ?? null;
        googleCalendarId = syncRecord?.google_calendar_id ?? null;
      }

      const { error } = await supabase.from("todos").delete().eq("id", id);

      if (!error) {
        setRawTodos((prev) => prev.filter((t) => t.id !== id));

        // Calendar sync (fire-and-forget) — pass event + calendar ID directly
        if (googleEventId) {
          syncTodoToCalendar("delete", id, undefined, googleEventId, googleCalendarId);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const toggleTodoTag = useCallback(
    async (todoId: string, tagId: string, add: boolean) => {
      if (add) {
        await supabase
          .from("todo_tags")
          .insert({ todo_id: todoId, tag_id: tagId });
      } else {
        await supabase
          .from("todo_tags")
          .delete()
          .eq("todo_id", todoId)
          .eq("tag_id", tagId);
      }

      setRawTodos((prev) =>
        prev.map((t) => {
          if (t.id !== todoId) return t;
          if (add) {
            if (t.tag_ids.includes(tagId)) return t;
            return { ...t, tag_ids: [...t.tag_ids, tagId] };
          }
          return { ...t, tag_ids: t.tag_ids.filter((id) => id !== tagId) };
        })
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const reorderTodos = useCallback(
    async (reordered: Todo[]) => {
      const orderById = new Map(reordered.map((t, index) => [t.id, index]));
      setRawTodos((prev) =>
        [...prev]
          .map((t) => (orderById.has(t.id) ? { ...t, sort_order: orderById.get(t.id)! } : t))
          .sort((a, b) => a.sort_order - b.sort_order)
      );
      // Only touch id/user_id/sort_order — upserting title or completed here
      // would overwrite edits made in another tab
      const updates = reordered.map((todo, index) => ({
        id: todo.id,
        user_id: todo.user_id,
        sort_order: index,
      }));
      await supabase.from("todos").upsert(updates);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Subtask operations
  const addSubtask = useCallback(
    async (todoId: string, title: string, options?: { due_date?: string | null; start_time?: string | null }) => {
      if (!userId) return;
      const todo = rawTodosRef.current.find((t) => t.id === todoId);
      const maxOrder =
        (todo?.subtasks ?? []).length > 0
          ? Math.max(...(todo?.subtasks ?? []).map((s) => s.sort_order))
          : 0;

      const { data, error } = await supabase
        .from("subtasks")
        .insert({
          todo_id: todoId,
          user_id: userId,
          title,
          sort_order: maxOrder + 1,
          due_date: options?.due_date ?? null,
          start_time: options?.start_time ?? null,
        })
        .select()
        .single();

      if (error || !data) return;

      setRawTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? { ...t, subtasks: [...(t.subtasks ?? []), data] }
            : t
        )
      );

      // Calendar sync — update parent event to reflect new subtask
      const parentTodo = todosRef.current.find((t) => t.id === todoId);
      if (parentTodo?.due_date) {
        const updatedSubtasks = [...(parentTodo.subtasks ?? []), data];
        syncTodoToCalendar("update", todoId, {
          title: parentTodo.title,
          due_date: parentTodo.due_date,
          start_date: parentTodo.start_date,
          start_time: parentTodo.start_time,
          end_time: parentTodo.end_time,
          priority: parentTodo.priority,
          notes: parentTodo.notes,
          completed: parentTodo.completed,
          subtasks: updatedSubtasks.map((s) => ({ title: s.title, completed: s.completed })),
          tag_names: (parentTodo.tags ?? []).map((t) => t.name),
          list_id: parentTodo.list_id,
          list_name: getListName(parentTodo.list_id),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId]
  );

  const toggleSubtask = useCallback(
    async (todoId: string, subtaskId: string, completed: boolean) => {
      const { error } = await supabase
        .from("subtasks")
        .update({ completed })
        .eq("id", subtaskId);

      if (!error) {
        setRawTodos((prev) =>
          prev.map((t) =>
            t.id === todoId
              ? {
                  ...t,
                  subtasks: (t.subtasks ?? []).map((s) =>
                    s.id === subtaskId ? { ...s, completed } : s
                  ),
                }
              : t
          )
        );

        // Calendar sync — update parent event to reflect toggled subtask
        const parentTodo = todosRef.current.find((t) => t.id === todoId);
        if (parentTodo?.due_date) {
          const updatedSubtasks = (parentTodo.subtasks ?? []).map((s) =>
            s.id === subtaskId ? { ...s, completed } : s
          );
          syncTodoToCalendar("update", todoId, {
            title: parentTodo.title,
            due_date: parentTodo.due_date,
            start_date: parentTodo.start_date,
            start_time: parentTodo.start_time,
            end_time: parentTodo.end_time,
            priority: parentTodo.priority,
            notes: parentTodo.notes,
            completed: parentTodo.completed,
            subtasks: updatedSubtasks.map((s) => ({ title: s.title, completed: s.completed })),
            tag_names: (parentTodo.tags ?? []).map((t) => t.name),
            list_id: parentTodo.list_id,
            list_name: getListName(parentTodo.list_id),
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const deleteSubtask = useCallback(
    async (todoId: string, subtaskId: string) => {
      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId);

      if (!error) {
        setRawTodos((prev) =>
          prev.map((t) =>
            t.id === todoId
              ? {
                  ...t,
                  subtasks: (t.subtasks ?? []).filter(
                    (s) => s.id !== subtaskId
                  ),
                }
              : t
          )
        );

        // Calendar sync — update parent event to reflect removed subtask
        const parentTodo = todosRef.current.find((t) => t.id === todoId);
        if (parentTodo?.due_date) {
          const updatedSubtasks = (parentTodo.subtasks ?? []).filter(
            (s) => s.id !== subtaskId
          );
          syncTodoToCalendar("update", todoId, {
            title: parentTodo.title,
            due_date: parentTodo.due_date,
            start_date: parentTodo.start_date,
            start_time: parentTodo.start_time,
            end_time: parentTodo.end_time,
            priority: parentTodo.priority,
            notes: parentTodo.notes,
            completed: parentTodo.completed,
            subtasks: updatedSubtasks.map((s) => ({ title: s.title, completed: s.completed })),
            tag_names: (parentTodo.tags ?? []).map((t) => t.name),
            list_id: parentTodo.list_id,
            list_name: getListName(parentTodo.list_id),
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const clearCompleted = useCallback(async () => {
    const completedTodos = todosRef.current.filter((t) => t.completed);
    const completedIds = completedTodos.map((t) => t.id);
    if (completedIds.length === 0) return;

    // Fetch sync records BEFORE deleting (cascade will remove them)
    const todosWithDueDates = completedTodos.filter((t) => t.due_date);
    let syncMap: Record<string, { eventId: string; calendarId: string | null }> = {};
    if (todosWithDueDates.length > 0) {
      const { data: syncRecords } = await supabase
        .from("calendar_sync")
        .select("todo_id, google_event_id, google_calendar_id")
        .in("todo_id", todosWithDueDates.map((t) => t.id));
      if (syncRecords) {
        syncMap = Object.fromEntries(
          syncRecords.map((r) => [r.todo_id, { eventId: r.google_event_id, calendarId: r.google_calendar_id }])
        );
      }
    }

    const { error } = await supabase
      .from("todos")
      .delete()
      .in("id", completedIds);

    if (!error) {
      setRawTodos((prev) => prev.filter((t) => !t.completed));

      // Calendar sync — delete each completed todo with a due_date
      for (const todo of todosWithDueDates) {
        const sync = syncMap[todo.id];
        if (sync) {
          syncTodoToCalendar("delete", todo.id, undefined, sync.eventId, sync.calendarId);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportTodos = useCallback(
    (format: "json" | "csv") => {
      if (format === "json") {
        const data = JSON.stringify(
          todos.map((t) => ({
            title: t.title,
            completed: t.completed,
            priority: t.priority,
            due_date: t.due_date,
            notes: t.notes,
            tags: (t.tags ?? []).map((tag) => tag.name),
            subtasks: (t.subtasks ?? []).map((s) => ({
              title: s.title,
              completed: s.completed,
            })),
          })),
          null,
          2
        );
        downloadFile(data, "todos.json", "application/json");
      } else {
        const rows = [
          ["Title", "Completed", "Priority", "Due Date", "Notes", "Tags"],
          ...todos.map((t) => [
            `"${t.title.replace(/"/g, '""')}"`,
            t.completed ? "Yes" : "No",
            t.priority,
            t.due_date ?? "",
            `"${(t.notes ?? "").replace(/"/g, '""')}"`,
            (t.tags ?? []).map((tag) => tag.name).join("; "),
          ]),
        ];
        const csv = rows.map((r) => r.join(",")).join("\n");
        downloadFile(csv, "todos.csv", "text/csv");
      }
    },
    [todos]
  );

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const assignTodoToEvent = useCallback(
    async (todoId: string, eventId: string | null, listId?: string | null) => {
      // Build update object — always update event_id, optionally update list_id
      const updates: Record<string, unknown> = { event_id: eventId };
      if (listId !== undefined) updates.list_id = listId;

      const { error } = await supabase
        .from("todos")
        .update(updates)
        .eq("id", todoId);

      if (!error) {
        setRawTodos((prev) =>
          prev.map((t) =>
            t.id === todoId
              ? { ...t, event_id: eventId, ...(listId !== undefined ? { list_id: listId } : {}) }
              : t
          )
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* Apply an event's list to all of its tasks (called when the event changes list) */
  const setListForEventTodos = useCallback(
    async (eventId: string, listId: string | null) => {
      const { error } = await supabase
        .from("todos")
        .update({ list_id: listId })
        .eq("event_id", eventId);

      if (!error) {
        setRawTodos((prev) =>
          prev.map((t) => (t.event_id === eventId ? { ...t, list_id: listId } : t))
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* Delete every task belonging to an event (called before the event itself) */
  const deleteTodosByEvent = useCallback(
    async (eventId: string) => {
      const { error } = await supabase.from("todos").delete().eq("event_id", eventId);
      if (!error) {
        setRawTodos((prev) => prev.filter((t) => t.event_id !== eventId));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    todos,
    loading,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    toggleTodoTag,
    reorderTodos,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    clearCompleted,
    exportTodos,
    assignTodoToEvent,
    setListForEventTodos,
    deleteTodosByEvent,
    refetchTodos: fetchTodos,
  };
}
