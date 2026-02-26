"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Todo, Tag, Subtask, Priority } from "@/lib/types";
import { syncTodoToCalendar } from "@/lib/calendar-sync-client";

export function useTodos(
  userId: string | undefined,
  allTags: Tag[],
  activeListId?: string | null
) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const todosRef = useRef(todos);
  todosRef.current = todos;

  const fetchTodos = useCallback(async () => {
    if (!userId) return;

    let query = supabase
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    if (activeListId) {
      query = query.eq("list_id", activeListId);
    }

    const { data: todosData, error: todosError } = await query;

    if (todosError || !todosData) {
      setLoading(false);
      return;
    }

    const todoIds = todosData.map((t) => t.id);
    let todoTagsMap: Record<string, string[]> = {};
    let subtasksMap: Record<string, Subtask[]> = {};

    if (todoIds.length > 0) {
      // Fetch tags
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

      // Fetch subtasks
      const { data: subtasksData } = await supabase
        .from("subtasks")
        .select("*")
        .in("todo_id", todoIds)
        .order("sort_order", { ascending: true });

      if (subtasksData) {
        subtasksMap = subtasksData.reduce(
          (acc, st) => {
            if (!acc[st.todo_id]) acc[st.todo_id] = [];
            acc[st.todo_id].push(st);
            return acc;
          },
          {} as Record<string, Subtask[]>
        );
      }
    }

    const todosWithData: Todo[] = todosData.map((todo) => ({
      ...todo,
      tags: (todoTagsMap[todo.id] ?? [])
        .map((tagId) => allTags.find((t) => t.id === tagId))
        .filter(Boolean) as Tag[],
      subtasks: subtasksMap[todo.id] ?? [],
    }));

    setTodos(todosWithData);
    setLoading(false);
  }, [userId, allTags, activeListId]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(
    async (
      title: string,
      tagIds: string[],
      options?: {
        due_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        priority?: Priority;
        notes?: string | null;
        list_id?: string | null;
      }
    ) => {
      if (!userId) return;

      const maxOrder =
        todos.length > 0 ? Math.max(...todos.map((t) => t.sort_order)) : 0;

      // Try with new columns first, fall back to basic insert if columns don't exist yet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let todoData: any = null;
      const { data: d1, error: e1 } = await supabase
        .from("todos")
        .insert({
          user_id: userId,
          title,
          sort_order: maxOrder + 1,
          due_date: options?.due_date ?? null,
          start_time: options?.start_time ?? null,
          end_time: options?.end_time ?? null,
          priority: options?.priority ?? "none",
          notes: options?.notes ?? null,
          list_id: options?.list_id ?? activeListId ?? null,
        })
        .select()
        .single();

      if (e1) {
        // Fallback: columns may not exist yet
        const { data: d2, error: e2 } = await supabase
          .from("todos")
          .insert({
            user_id: userId,
            title,
            sort_order: maxOrder + 1,
          })
          .select()
          .single();
        if (e2 || !d2) return;
        todoData = d2;
      } else {
        todoData = d1;
      }

      if (!todoData) return;

      if (tagIds.length > 0) {
        await supabase
          .from("todo_tags")
          .insert(tagIds.map((tagId) => ({ todo_id: todoData.id, tag_id: tagId })));
      }

      const newTodo: Todo = {
        ...todoData,
        priority: todoData.priority ?? "none",
        tags: tagIds
          .map((id) => allTags.find((t) => t.id === id))
          .filter(Boolean) as Tag[],
        subtasks: [],
      };

      setTodos((prev) => [...prev, newTodo]);

      // Calendar sync (fire-and-forget)
      if (options?.due_date) {
        const tagNames = tagIds
          .map((id) => allTags.find((t) => t.id === id)?.name)
          .filter(Boolean) as string[];
        syncTodoToCalendar("create", todoData.id, {
          title,
          due_date: options.due_date,
          start_time: options.start_time,
          end_time: options.end_time,
          priority: options.priority,
          notes: options.notes,
          completed: false,
          subtasks: [],
          tag_names: tagNames,
        });
      }
    },
    [userId, todos, allTags, activeListId]
  );

  const toggleTodo = useCallback(
    async (id: string, completed: boolean) => {
      const { error } = await supabase
        .from("todos")
        .update({ completed })
        .eq("id", id);

      if (!error) {
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, completed } : t))
        );

        // Calendar sync (fire-and-forget)
        const todo = todosRef.current.find((t) => t.id === id);
        if (todo?.due_date) {
          syncTodoToCalendar("complete", id, {
            title: todo.title,
            due_date: todo.due_date,
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
          });
        }
      }
    },
    []
  );

  const updateTodo = useCallback(
    async (
      id: string,
      updates: {
        title?: string;
        due_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        priority?: Priority;
        notes?: string | null;
        list_id?: string | null;
      }
    ) => {
      const { error } = await supabase
        .from("todos")
        .update(updates)
        .eq("id", id);

      if (error) {
        // Fallback: only update title if new columns don't exist yet
        if (updates.title) {
          const { error: e2 } = await supabase
            .from("todos")
            .update({ title: updates.title })
            .eq("id", id);
          if (!e2) {
            setTodos((prev) =>
              prev.map((t) => (t.id === id ? { ...t, title: updates.title! } : t))
            );
          }
        }
        return;
      }

      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );

      // Calendar sync (fire-and-forget)
      const existingTodo = todosRef.current.find((t) => t.id === id);
      if (existingTodo) {
        const merged = { ...existingTodo, ...updates };
        if (merged.due_date || existingTodo.due_date) {
          syncTodoToCalendar("update", id, {
            title: merged.title,
            due_date: merged.due_date,
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
          });
        }
      }
    },
    []
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      // Capture todo data before deletion for calendar sync
      const todo = todosRef.current.find((t) => t.id === id);

      const { error } = await supabase.from("todos").delete().eq("id", id);

      if (!error) {
        setTodos((prev) => prev.filter((t) => t.id !== id));

        // Calendar sync (fire-and-forget)
        if (todo?.due_date) {
          syncTodoToCalendar("delete", id);
        }
      }
    },
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

      setTodos((prev) =>
        prev.map((t) => {
          if (t.id !== todoId) return t;
          const currentTags = t.tags ?? [];
          if (add) {
            const tag = allTags.find((at) => at.id === tagId);
            if (tag) return { ...t, tags: [...currentTags, tag] };
          } else {
            return { ...t, tags: currentTags.filter((ct) => ct.id !== tagId) };
          }
          return t;
        })
      );
    },
    [allTags]
  );

  const reorderTodos = useCallback(
    async (reordered: Todo[]) => {
      setTodos(reordered);
      const updates = reordered.map((todo, index) => ({
        id: todo.id,
        sort_order: index,
        user_id: todo.user_id,
        title: todo.title,
        completed: todo.completed,
      }));
      await supabase.from("todos").upsert(updates);
    },
    []
  );

  // Subtask operations
  const addSubtask = useCallback(
    async (todoId: string, title: string) => {
      if (!userId) return;
      const todo = todos.find((t) => t.id === todoId);
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
        })
        .select()
        .single();

      if (error || !data) return;

      setTodos((prev) =>
        prev.map((t) =>
          t.id === todoId
            ? { ...t, subtasks: [...(t.subtasks ?? []), data] }
            : t
        )
      );
    },
    [userId, todos]
  );

  const toggleSubtask = useCallback(
    async (todoId: string, subtaskId: string, completed: boolean) => {
      const { error } = await supabase
        .from("subtasks")
        .update({ completed })
        .eq("id", subtaskId);

      if (!error) {
        setTodos((prev) =>
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
      }
    },
    []
  );

  const deleteSubtask = useCallback(
    async (todoId: string, subtaskId: string) => {
      const { error } = await supabase
        .from("subtasks")
        .delete()
        .eq("id", subtaskId);

      if (!error) {
        setTodos((prev) =>
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
      }
    },
    []
  );

  const clearCompleted = useCallback(async () => {
    const completedTodos = todos.filter((t) => t.completed);
    const completedIds = completedTodos.map((t) => t.id);
    if (completedIds.length === 0) return;

    const { error } = await supabase
      .from("todos")
      .delete()
      .in("id", completedIds);

    if (!error) {
      setTodos((prev) => prev.filter((t) => !t.completed));

      // Calendar sync — delete each completed todo with a due_date
      for (const todo of completedTodos) {
        if (todo.due_date) {
          syncTodoToCalendar("delete", todo.id);
        }
      }
    }
  }, [todos]);

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
  };
}
