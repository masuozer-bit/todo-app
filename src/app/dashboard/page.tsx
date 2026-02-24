"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import TodoInput from "@/components/TodoInput";
import TodoList from "@/components/TodoList";
import TagManager from "@/components/TagManager";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setAuthLoading(false);
    });
  }, [supabase, router]);

  const { tags, addTag, deleteTag } = useTags(user?.id);
  const {
    todos,
    loading: todosLoading,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    toggleTodoTag,
    reorderTodos,
  } = useTodos(user?.id, tags);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-6 h-6 border-2 border-gray-400/30 border-t-black dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const activeTodoCount = todos.filter((t) => !t.completed).length;
  const completedTodoCount = todos.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors">
      <Header email={user?.email} />

      <main className="max-w-2xl mx-auto px-4 pb-16">
        {/* Stats */}
        <div className="flex items-baseline gap-4 mb-8 mt-4">
          <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white">
            Your tasks
          </h2>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{activeTodoCount} active</span>
            {completedTodoCount > 0 && (
              <span>{completedTodoCount} done</span>
            )}
          </div>
        </div>

        {/* Todo Input */}
        <div className="mb-4">
          <TodoInput onAdd={addTodo} tags={tags} />
        </div>

        {/* Tag Manager */}
        <div className="mb-6">
          <TagManager tags={tags} onAdd={addTag} onDelete={deleteTag} />
        </div>

        {/* Todo List */}
        <TodoList
          todos={todos}
          allTags={tags}
          onToggle={toggleTodo}
          onUpdate={updateTodo}
          onDelete={deleteTodo}
          onTagToggle={toggleTodoTag}
          onReorder={reorderTodos}
          loading={todosLoading}
        />
      </main>
    </div>
  );
}
