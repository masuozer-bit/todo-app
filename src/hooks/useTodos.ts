"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Todo, Tag } from "@/lib/types";

export function useTodos(userId: string | undefined, allTags: Tag[]) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTodos = useCallback(async () => {
    if (!userId) return;

    // Fetch todos
    const { data: todosData, error: todosError } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    if (todosError || !todosData) {
      setLoading(false);
      return;
    }

    // Fetch todo_tags
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

    // Merge tags into todos
    const todosWithTags: Todo[] = todosData.map((todo) => ({
      ...todo,
      tags: (todoTagsMap[todo.id] ?? [])
        .map((tagId) => allTags.find((t) => t.id === tagId))
        .filter(Boolean) as Tag[],
    }));

    setTodos(todosWithTags);
    setLoading(false);
  }, [userId, allTags, supabase]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(
    async (title: string, tagIds: string[]) => {
      if (!userId) return;

      const maxOrder = todos.length > 0
        ? Math.max(...todos.map((t) => t.sort_order))
        : 0;

      const { data, error } = await supabase
        .from("todos")
        .insert({
          user_id: userId,
          title,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error || !data) return;

      // Add tags
      if (tagIds.length > 0) {
        await supabase
          .from("todo_tags")
          .insert(tagIds.map((tagId) => ({ todo_id: data.id, tag_id: tagId })));
      }

      const newTodo: Todo = {
        ...data,
        tags: tagIds
          .map((id) => allTags.find((t) => t.id === id))
          .filter(Boolean) as Tag[],
      };

      setTodos((prev) => [...prev, newTodo]);
    },
    [userId, todos, allTags, supabase]
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
      }
    },
    [supabase]
  );

  const updateTodo = useCallback(
    async (id: string, title: string) => {
      const { error } = await supabase
        .from("todos")
        .update({ title })
        .eq("id", id);

      if (!error) {
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, title } : t))
        );
      }
    },
    [supabase]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("todos").delete().eq("id", id);

      if (!error) {
        setTodos((prev) => prev.filter((t) => t.id !== id));
      }
    },
    [supabase]
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
    [allTags, supabase]
  );

  const reorderTodos = useCallback(
    async (reordered: Todo[]) => {
      setTodos(reordered);

      // Batch update sort_order
      const updates = reordered.map((todo, index) => ({
        id: todo.id,
        sort_order: index,
        user_id: todo.user_id,
        title: todo.title,
        completed: todo.completed,
      }));

      await supabase.from("todos").upsert(updates);
    },
    [supabase]
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
  };
}
