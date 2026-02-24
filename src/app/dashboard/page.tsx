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
import { useLists } from "@/hooks/useLists";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "@/components/ThemeProvider";
import { Plus, List, Inbox, Trash2, Edit2, Check, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const { toggleTheme } = useTheme();

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
  const { lists, addList, updateList, deleteList } = useLists(user?.id);
  const {
    todos,
    loading: todosLoading,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    toggleTodoTag,
    reorderTodos,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useTodos(user?.id, tags, activeListId);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="New task title"]'
      );
      input?.focus();
    },
    onSearch: () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Search tasks"]'
      );
      input?.focus();
    },
    onToggleTheme: toggleTheme,
  });

  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;
    await addList(trimmed);
    setNewListName("");
    setShowNewList(false);
  }

  async function handleUpdateList(id: string) {
    const trimmed = editListName.trim();
    if (trimmed) await updateList(id, trimmed);
    setEditingListId(null);
    setEditListName("");
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-6 h-6 border-2 border-gray-400/30 border-t-black dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const activeList = lists.find((l) => l.id === activeListId);
  const activeTodoCount = todos.filter((t) => !t.completed).length;
  const completedTodoCount = todos.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors">
      <Header email={user?.email} />

      <div className="max-w-5xl mx-auto px-4 pb-16 flex gap-6">
        {/* Sidebar — lists */}
        <aside className="hidden md:block w-52 flex-shrink-0 pt-4">
          <div className="sticky top-4">
            {/* All Tasks */}
            <button
              onClick={() => setActiveListId(null)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                !activeListId
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Inbox size={15} />
              All Tasks
            </button>

            {/* Lists */}
            {lists.length > 0 && (
              <div className="mt-3 mb-2">
                <p className="text-xs font-medium text-gray-400 px-3 mb-1 uppercase tracking-wide">
                  Lists
                </p>
                <div className="space-y-0.5">
                  {lists.map((list) => (
                    <div
                      key={list.id}
                      className={`group flex items-center gap-1 rounded-xl transition-default ${
                        activeListId === list.id
                          ? "bg-black dark:bg-white"
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      {editingListId === list.id ? (
                        <div className="flex-1 flex items-center gap-1 px-2 py-1">
                          <input
                            autoFocus
                            type="text"
                            value={editListName}
                            onChange={(e) => setEditListName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdateList(list.id);
                              if (e.key === "Escape") setEditingListId(null);
                            }}
                            className="flex-1 text-sm bg-transparent text-black dark:text-white focus:outline-none min-w-0"
                          />
                          <button
                            onClick={() => handleUpdateList(list.id)}
                            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditingListId(null)}
                            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setActiveListId(list.id)}
                            className={`flex-1 flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-default ${
                              activeListId === list.id
                                ? "text-white dark:text-black font-medium"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            <List size={14} />
                            <span className="truncate">{list.name}</span>
                          </button>
                          <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-default">
                            <button
                              onClick={() => {
                                setEditingListId(list.id);
                                setEditListName(list.name);
                              }}
                              className={`p-1 rounded transition-default ${
                                activeListId === list.id
                                  ? "text-white/60 dark:text-black/60 hover:text-white dark:hover:text-black"
                                  : "text-gray-400 hover:text-black dark:hover:text-white"
                              }`}
                              aria-label="Edit list"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={() => {
                                deleteList(list.id);
                                if (activeListId === list.id)
                                  setActiveListId(null);
                              }}
                              className={`p-1 rounded transition-default ${
                                activeListId === list.id
                                  ? "text-white/60 dark:text-black/60 hover:text-white dark:hover:text-black"
                                  : "text-gray-400 hover:text-black dark:hover:text-white"
                              }`}
                              aria-label="Delete list"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add list */}
            {showNewList ? (
              <form
                onSubmit={handleAddList}
                className="flex items-center gap-1 px-2 mt-2"
              >
                <input
                  autoFocus
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowNewList(false);
                  }}
                  placeholder="List name..."
                  className="flex-1 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewList(false)}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  <X size={12} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowNewList(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default w-full rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Plus size={13} />
                New list
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-4">
          {/* Stats */}
          <div className="flex items-baseline gap-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white">
              {activeList ? activeList.name : "All Tasks"}
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
            <TodoInput
              onAdd={addTodo}
              tags={tags}
              lists={lists}
              activeListId={activeListId}
            />
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
            onAddSubtask={addSubtask}
            onToggleSubtask={toggleSubtask}
            onDeleteSubtask={deleteSubtask}
            loading={todosLoading}
          />
        </main>
      </div>

      {/* Mobile: list selector at bottom */}
      {lists.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-black/5 dark:border-white/5 px-4 py-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveListId(null)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-default ${
              !activeListId
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "text-gray-400 border border-black/10 dark:border-white/10"
            }`}
          >
            All
          </button>
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => setActiveListId(list.id)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-default ${
                activeListId === list.id
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-400 border border-black/10 dark:border-white/10"
              }`}
            >
              {list.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
