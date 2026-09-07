"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type { Todo, Tag, Subtask, Priority, List } from "@/lib/types";
import { syncTodoToCalendar } from "@/lib/calendar-sync-client";

/* Todos as they live in state: tags are stored as IDs and resolved on render,
   so loading the tag list never forces a second todo fetch. */
type RawTodo = Omit<Todo, "tags"> & { tag_ids: string[] };

export type TodoUpdates = {
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
};

/* Fields Google Calendar cares about — time_spent ticks every 30s and must
   never trigger a sync */
const CALENDAR_FIELDS = new Set([
  "title",
  "due_date",
  "start_date",
  "start_time",
  "end_time",
  "notes",
  "completed",
  "list_id",
]);

export function useTodos(
  userId: string | undefined,
  allTags: Tag[],
  activeListId?: string | null,
  allLists?: List[]
) {
  const [rawTodos, setRawTodos] = useState<RawTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const supabase = createClient();
  const { showToast, showError } = useToast();

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

  /* Put a single todo back the way it was after a failed request */
  const rollbackTodo = useCallback((id: string, previous: RawTodo | undefined) => {
    setRawTodos((prev) => {
      if (!previous) return prev.filter((t) => t.id !== id);
      if (prev.some((t) => t.id === id)) {
        return prev.map((t) => (t.id === id ? previous : t));
      }
      return [...prev, previous].sort((a, b) => a.sort_order - b.sort_order);
    });
  }, []);

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
      // An empty list and a failed request must not look the same
      setLoadError(true);
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
    setLoadError(false);
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
      const listId =
        options !== undefined && "list_id" in options ? options.list_id ?? null : (activeListId ?? null);

      const row = {
        user_id: userId,
        title,
        sort_order: maxOrder + 1,
        due_date: options?.due_date ?? null,
        start_date: options?.start_date ?? null,
        start_time: options?.start_time ?? null,
        end_time: options?.end_time ?? null,
        priority: options?.priority ?? "none",
        notes: options?.notes ?? null,
        list_id: listId,
        event_id: options?.event_id ?? null,
      };

      // Show it right away, swap in the real row when the insert returns
      const tempId = `temp-${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();
      setRawTodos((prev) => [
        ...prev,
        {
          ...row,
          id: tempId,
          completed: false,
          created_at: now,
          updated_at: now,
          tag_ids: tagIds,
          subtasks: [],
        } as RawTodo,
      ]);

      const { data: todoData, error } = await supabase
        .from("todos")
        .insert(row)
        .select()
        .single();

      if (error || !todoData) {
        setRawTodos((prev) => prev.filter((t) => t.id !== tempId));
        showError("Task could not be saved");
        return;
      }

      setRawTodos((prev) =>
        prev.map((t) =>
          t.id === tempId
            ? { ...todoData, priority: todoData.priority ?? "none", tag_ids: tagIds, subtasks: [] }
            : t
        )
      );

      if (tagIds.length > 0) {
        const { error: tagError } = await supabase
          .from("todo_tags")
          .insert(tagIds.map((tagId) => ({ todo_id: todoData.id, tag_id: tagId })));
        if (tagError) showError("Tags could not be saved");
      }

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
          list_id: listId,
          list_name: getListName(listId),
        });
      }

      return todoData.id as string;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, allTags, activeListId, showError]
  );

  const toggleTodo = useCallback(
    async (id: string, completed: boolean) => {
      const todo = todosRef.current.find((t) => t.id === id);
      const previous = rawTodosRef.current.find((t) => t.id === id);

      setRawTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed } : t))
      );

      const { error } = await supabase
        .from("todos")
        .update({ completed })
        .eq("id", id);

      if (error) {
        rollbackTodo(id, previous);
        showError("Task could not be updated");
        return;
      }

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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollbackTodo, showError]
  );

  const updateTodo = useCallback(
    async (id: string, updates: TodoUpdates) => {
      const previous = rawTodosRef.current.find((t) => t.id === id);

      setRawTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );

      const { error } = await supabase
        .from("todos")
        .update(updates)
        .eq("id", id);

      if (error) {
        rollbackTodo(id, previous);
        showError("Change could not be saved");
        return;
      }

      // Calendar sync (fire-and-forget) — skip for Google-imported todos and
      // for changes the calendar does not care about (e.g. tracked time)
      const touchesCalendar = Object.keys(updates).some((key) => CALENDAR_FIELDS.has(key));
      if (!touchesCalendar) return;

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
    [rollbackTodo, showError]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      const todo = todosRef.current.find((t) => t.id === id);
      const previous = rawTodosRef.current.find((t) => t.id === id);

      // Gone from the list immediately — the request runs behind it
      setRawTodos((prev) => prev.filter((t) => t.id !== id));

      // Fetch sync record BEFORE deleting (cascade will remove it)
      let googleEventId: string | null = null;
      let googleCalendarId: string | null = null;
      if (todo?.due_date) {
        const { data: syncRecord } = await supabase
          .from("calendar_sync")
          .select("google_event_id, google_calendar_id")
          .eq("todo_id", id)
          .maybeSingle();
        googleEventId = syncRecord?.google_event_id ?? null;
        googleCalendarId = syncRecord?.google_calendar_id ?? null;
      }

      const { error } = await supabase.from("todos").delete().eq("id", id);

      if (error) {
        rollbackTodo(id, previous);
        showError("Task could not be deleted");
        return;
      }

      // Calendar sync (fire-and-forget) — pass event + calendar ID directly
      if (googleEventId) {
        syncTodoToCalendar("delete", id, undefined, googleEventId, googleCalendarId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollbackTodo, showError]
  );

  /* Undo for a deleted task — same ID, same subtasks, same tags */
  const restoreTodo = useCallback(
    async (todo: Todo) => {
      const tagIds = (todo.tags ?? []).map((t) => t.id);
      const subtasks = todo.subtasks ?? [];
      const restored: RawTodo = { ...todo, tag_ids: tagIds, subtasks };
      delete (restored as Partial<Todo>).tags;

      setRawTodos((prev) =>
        prev.some((t) => t.id === todo.id)
          ? prev
          : [...prev, restored].sort((a, b) => a.sort_order - b.sort_order)
      );

      const { tags: _tags, subtasks: _subtasks, ...row } = todo;
      const { error } = await supabase.from("todos").insert(row);

      if (error) {
        setRawTodos((prev) => prev.filter((t) => t.id !== todo.id));
        showError("Task could not be restored");
        return;
      }

      if (subtasks.length > 0) await supabase.from("subtasks").insert(subtasks);
      if (tagIds.length > 0) {
        await supabase
          .from("todo_tags")
          .insert(tagIds.map((tagId) => ({ todo_id: todo.id, tag_id: tagId })));
      }

      if (todo.due_date && !todo.google_event_id) {
        syncTodoToCalendar("create", todo.id, {
          title: todo.title,
          due_date: todo.due_date,
          start_date: todo.start_date,
          start_time: todo.start_time,
          end_time: todo.end_time,
          priority: todo.priority,
          notes: todo.notes,
          completed: todo.completed,
          subtasks: subtasks.map((s) => ({ title: s.title, completed: s.completed })),
          tag_names: (todo.tags ?? []).map((t) => t.name),
          list_id: todo.list_id,
          list_name: getListName(todo.list_id),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const toggleTodoTag = useCallback(
    async (todoId: string, tagId: string, add: boolean) => {
      const previous = rawTodosRef.current.find((t) => t.id === todoId);

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

      const { error } = add
        ? await supabase.from("todo_tags").insert({ todo_id: todoId, tag_id: tagId })
        : await supabase
            .from("todo_tags")
            .delete()
            .eq("todo_id", todoId)
            .eq("tag_id", tagId);

      if (error) {
        rollbackTodo(todoId, previous);
        showError("Tag could not be updated");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollbackTodo, showError]
  );

  const reorderTodos = useCallback(
    async (reordered: Todo[]) => {
      const previous = rawTodosRef.current;
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
      const { error } = await supabase.from("todos").upsert(updates);
      if (error) {
        setRawTodos(previous);
        showError("New order could not be saved");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  /* Rebuild the calendar payload for a task whose subtasks changed */
  const syncParent = useCallback((todoId: string, subtasks: Subtask[]) => {
    const parentTodo = todosRef.current.find((t) => t.id === todoId);
    if (!parentTodo?.due_date || parentTodo.google_event_id) return;
    syncTodoToCalendar("update", todoId, {
      title: parentTodo.title,
      due_date: parentTodo.due_date,
      start_date: parentTodo.start_date,
      start_time: parentTodo.start_time,
      end_time: parentTodo.end_time,
      priority: parentTodo.priority,
      notes: parentTodo.notes,
      completed: parentTodo.completed,
      subtasks: subtasks.map((s) => ({ title: s.title, completed: s.completed })),
      tag_names: (parentTodo.tags ?? []).map((t) => t.name),
      list_id: parentTodo.list_id,
      list_name: getListName(parentTodo.list_id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subtask operations
  const addSubtask = useCallback(
    async (todoId: string, title: string, options?: { due_date?: string | null; start_time?: string | null }) => {
      if (!userId) return;
      const todo = rawTodosRef.current.find((t) => t.id === todoId);
      const maxOrder =
        (todo?.subtasks ?? []).length > 0
          ? Math.max(...(todo?.subtasks ?? []).map((s) => s.sort_order))
          : 0;

      const tempId = `temp-${Math.random().toString(36).slice(2)}`;
      const optimistic: Subtask = {
        id: tempId,
        todo_id: todoId,
        user_id: userId,
        title,
        completed: false,
        sort_order: maxOrder + 1,
        created_at: new Date().toISOString(),
        due_date: options?.due_date ?? null,
        start_time: options?.start_time ?? null,
      };

      setRawTodos((prev) =>
        prev.map((t) =>
          t.id === todoId ? { ...t, subtasks: [...(t.subtasks ?? []), optimistic] } : t
        )
      );

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

      if (error || !data) {
        setRawTodos((prev) =>
          prev.map((t) =>
            t.id === todoId
              ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== tempId) }
              : t
          )
        );
        showError("Subtask could not be saved");
        return;
      }

      setRawTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? { ...t, subtasks: (t.subtasks ?? []).map((s) => (s.id === tempId ? data : s)) }
            : t
        )
      );

      const parent = rawTodosRef.current.find((t) => t.id === todoId);
      syncParent(todoId, [...(parent?.subtasks ?? []).filter((s) => s.id !== tempId), data]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, syncParent, showError]
  );

  const toggleSubtask = useCallback(
    async (todoId: string, subtaskId: string, completed: boolean) => {
      const previous = rawTodosRef.current.find((t) => t.id === todoId);

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

      const { error } = await supabase
        .from("subtasks")
        .update({ completed })
        .eq("id", subtaskId);

      if (error) {
        rollbackTodo(todoId, previous);
        showError("Subtask could not be updated");
        return;
      }

      syncParent(
        todoId,
        (previous?.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, completed } : s))
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollbackTodo, syncParent, showError]
  );

  const deleteSubtask = useCallback(
    async (todoId: string, subtaskId: string) => {
      const previous = rawTodosRef.current.find((t) => t.id === todoId);

      setRawTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subtaskId) }
            : t
        )
      );

      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) {
        rollbackTodo(todoId, previous);
        showError("Subtask could not be deleted");
        return;
      }

      syncParent(todoId, (previous?.subtasks ?? []).filter((s) => s.id !== subtaskId));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollbackTodo, syncParent, showError]
  );

  // ── Bulk operations — one request instead of one per task ──────────────────

  const bulkComplete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const previous = rawTodosRef.current;
      const affected = previous.filter((t) => ids.includes(t.id));

      setRawTodos((prev) =>
        prev.map((t) => (ids.includes(t.id) ? { ...t, completed: true } : t))
      );

      const { error } = await supabase
        .from("todos")
        .update({ completed: true })
        .in("id", ids);

      if (error) {
        setRawTodos(previous);
        showError("Tasks could not be completed");
        return;
      }

      for (const todo of affected) {
        if (!todo.due_date || todo.google_event_id) continue;
        syncTodoToCalendar("complete", todo.id, {
          title: todo.title,
          due_date: todo.due_date,
          start_date: todo.start_date,
          start_time: todo.start_time,
          end_time: todo.end_time,
          priority: todo.priority,
          notes: todo.notes,
          completed: true,
          subtasks: (todo.subtasks ?? []).map((s) => ({ title: s.title, completed: s.completed })),
          tag_names: [],
          list_id: todo.list_id,
          list_name: getListName(todo.list_id),
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const bulkUpdate = useCallback(
    async (ids: string[], updates: TodoUpdates) => {
      if (ids.length === 0) return;
      const previous = rawTodosRef.current;

      setRawTodos((prev) =>
        prev.map((t) => (ids.includes(t.id) ? { ...t, ...updates } : t))
      );

      const { error } = await supabase.from("todos").update(updates).in("id", ids);

      if (error) {
        setRawTodos(previous);
        showError("Tasks could not be updated");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const bulkDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const previous = rawTodosRef.current;
      const affected = previous.filter((t) => ids.includes(t.id));

      setRawTodos((prev) => prev.filter((t) => !ids.includes(t.id)));

      const withDueDates = affected.filter((t) => t.due_date);
      let syncMap: Record<string, { eventId: string; calendarId: string | null }> = {};
      if (withDueDates.length > 0) {
        const { data: syncRecords } = await supabase
          .from("calendar_sync")
          .select("todo_id, google_event_id, google_calendar_id")
          .in("todo_id", withDueDates.map((t) => t.id));
        if (syncRecords) {
          syncMap = Object.fromEntries(
            syncRecords.map((r) => [r.todo_id, { eventId: r.google_event_id, calendarId: r.google_calendar_id }])
          );
        }
      }

      const { error } = await supabase.from("todos").delete().in("id", ids);

      if (error) {
        setRawTodos(previous);
        showError("Tasks could not be deleted");
        return;
      }

      for (const todo of withDueDates) {
        const sync = syncMap[todo.id];
        if (sync) syncTodoToCalendar("delete", todo.id, undefined, sync.eventId, sync.calendarId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const clearCompleted = useCallback(async () => {
    const completedIds = rawTodosRef.current.filter((t) => t.completed).map((t) => t.id);
    await bulkDelete(completedIds);
  }, [bulkDelete]);

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
      const previous = rawTodosRef.current.find((t) => t.id === todoId);

      // Build update object — always update event_id, optionally update list_id
      const updates: Record<string, unknown> = { event_id: eventId };
      if (listId !== undefined) updates.list_id = listId;

      setRawTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? { ...t, event_id: eventId, ...(listId !== undefined ? { list_id: listId } : {}) }
            : t
        )
      );

      const { error } = await supabase
        .from("todos")
        .update(updates)
        .eq("id", todoId);

      if (error) {
        rollbackTodo(todoId, previous);
        showError("Task could not be moved");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rollbackTodo, showError]
  );

  /* Apply an event's list to all of its tasks (called when the event changes list) */
  const setListForEventTodos = useCallback(
    async (eventId: string, listId: string | null) => {
      const previous = rawTodosRef.current;

      setRawTodos((prev) =>
        prev.map((t) => (t.event_id === eventId ? { ...t, list_id: listId } : t))
      );

      const { error } = await supabase
        .from("todos")
        .update({ list_id: listId })
        .eq("event_id", eventId);

      if (error) {
        setRawTodos(previous);
        showError("Tasks could not be moved to the new list");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  /* Delete every task belonging to an event (called before the event itself) */
  const deleteTodosByEvent = useCallback(
    async (eventId: string) => {
      const previous = rawTodosRef.current;

      setRawTodos((prev) => prev.filter((t) => t.event_id !== eventId));

      const { error } = await supabase.from("todos").delete().eq("event_id", eventId);

      if (error) {
        setRawTodos(previous);
        showError("Event tasks could not be deleted");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  return {
    todos,
    loading,
    loadError,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    restoreTodo,
    toggleTodoTag,
    reorderTodos,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    bulkComplete,
    bulkUpdate,
    bulkDelete,
    clearCompleted,
    exportTodos,
    assignTodoToEvent,
    setListForEventTodos,
    deleteTodosByEvent,
    refetchTodos: fetchTodos,
  };
}
