"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import TodoInput from "@/components/TodoInput";
import TodoList from "@/components/TodoList";
import TagManager from "@/components/TagManager";
import CalendarPanel from "@/components/CalendarPanel";
import HabitInput from "@/components/HabitInput";
import HabitList from "@/components/HabitList";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import { useLists } from "@/hooks/useLists";
import { useHabits } from "@/hooks/useHabits";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "@/components/ThemeProvider";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, List, Inbox, Trash2, Edit2, Check, X, Calendar, Repeat } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { List as ListType } from "@/lib/types";

function SortableListItem({
  list,
  isActive,
  isEditing,
  editListName,
  setEditListName,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  list: ListType;
  isActive: boolean;
  isEditing: boolean;
  editListName: string;
  setEditListName: (v: string) => void;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-0.5 rounded-xl transition-default ${
        isDragging ? "opacity-50 z-10" : ""
      } ${
        isActive
          ? "bg-black dark:bg-white"
          : "hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1 px-2 py-1">
          <input
            autoFocus
            type="text"
            value={editListName}
            onChange={(e) => setEditListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="flex-1 text-sm bg-transparent text-black dark:text-white focus:outline-none min-w-0"
          />
          <button
            onClick={onSaveEdit}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
          >
            <Check size={12} />
          </button>
          <button
            onClick={onCancelEdit}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={onSelect}
            {...attributes}
            {...listeners}
            className={`flex-1 flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-default touch-none ${
              isActive
                ? "text-white dark:text-black font-medium"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <List size={14} />
            <span className="truncate">{list.name}</span>
          </button>
          <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-default">
            <button
              onClick={onStartEdit}
              className={`p-1 rounded transition-default ${
                isActive
                  ? "text-white/60 dark:text-black/60 hover:text-white dark:hover:text-black"
                  : "text-gray-400 hover:text-black dark:hover:text-white"
              }`}
              aria-label="Edit list"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={onDelete}
              className={`p-1 rounded transition-default ${
                isActive
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
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [habitsView, setHabitsView] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toggleTheme } = useTheme();

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(async ({ data: { user } }) => {
        if (!user) {
          // Clear stale session cookie to prevent redirect loops
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }
        setUser(user);
        setAuthLoading(false);
      })
      .catch(async () => {
        await supabase.auth.signOut();
        router.push("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { tags, addTag, deleteTag } = useTags(user?.id);
  const { lists, addList, updateList, deleteList, reorderLists } = useLists(user?.id);
  const {
    habits,
    todaysHabits,
    loading: habitsLoading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    reorderHabits,
  } = useHabits(user?.id);
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

  // Sensors for list drag & drop
  const listSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleListDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lists.findIndex((l) => l.id === active.id);
    const newIndex = lists.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lists, oldIndex, newIndex);
    reorderLists(reordered);
  }

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

  function switchToHabits() {
    setHabitsView(true);
    setActiveListId(null);
    setShowCalendar(false);
    setCalendarDate(null);
  }

  function switchToAllTasks() {
    setHabitsView(false);
    setActiveListId(null);
  }

  function switchToList(listId: string) {
    setHabitsView(false);
    setActiveListId(listId);
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
      <div className={`mx-auto px-4 pt-6 pb-8 flex gap-6 ${showCalendar ? "max-w-6xl" : "max-w-5xl"}`}>
        {/* Sidebar — lists */}
        <aside className="hidden md:block w-52 flex-shrink-0 pt-4">
          <div className="sticky top-4">
            {/* All Tasks */}
            <button
              onClick={switchToAllTasks}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                !activeListId && !habitsView
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Inbox size={15} />
              All Tasks
            </button>

            {/* Habits */}
            <button
              onClick={switchToHabits}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                habitsView
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Repeat size={15} />
              Habits
            </button>

            {/* Lists */}
            {lists.length > 0 && (
              <div className="mt-3 mb-2">
                <p className="text-xs font-medium text-gray-400 px-3 mb-1 uppercase tracking-wide">
                  Lists
                </p>
                <DndContext
                  sensors={listSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleListDragEnd}
                >
                  <SortableContext
                    items={lists.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-0.5">
                      {lists.map((list) => (
                        <SortableListItem
                          key={list.id}
                          list={list}
                          isActive={activeListId === list.id}
                          isEditing={editingListId === list.id}
                          editListName={editListName}
                          setEditListName={setEditListName}
                          onSelect={() => switchToList(list.id)}
                          onStartEdit={() => {
                            setEditingListId(list.id);
                            setEditListName(list.name);
                          }}
                          onSaveEdit={() => handleUpdateList(list.id)}
                          onCancelEdit={() => setEditingListId(null)}
                          onDelete={() => {
                            deleteList(list.id);
                            if (activeListId === list.id) setActiveListId(null);
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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

            {/* Tag Manager — tucked into sidebar */}
            <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5 px-1">
              <TagManager tags={tags} onAdd={addTag} onDelete={deleteTag} />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-4">
          {/* Stats + calendar toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-baseline gap-4">
              <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white">
                {habitsView
                  ? "Habits"
                  : activeList
                    ? activeList.name
                    : "All Tasks"}
              </h2>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                {habitsView ? (
                  <span>
                    {todaysHabits.filter((h) => h.completedToday).length}/
                    {todaysHabits.length} today
                  </span>
                ) : (
                  <>
                    <span>{activeTodoCount} active</span>
                    {completedTodoCount > 0 && (
                      <span>{completedTodoCount} done</span>
                    )}
                  </>
                )}
              </div>
            </div>
            {!habitsView && (
              <button
                onClick={() => {
                  setShowCalendar(!showCalendar);
                  if (showCalendar) setCalendarDate(null);
                }}
                className={`hidden md:flex w-10 h-10 rounded-xl glass-card-subtle items-center justify-center transition-default ${
                  showCalendar
                    ? "bg-black dark:bg-white text-white dark:text-black"
                    : "text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                aria-label={showCalendar ? "Hide calendar" : "Show calendar"}
              >
                <Calendar size={18} />
              </button>
            )}
          </div>

          {/* Calendar date filter indicator */}
          {!habitsView && calendarDate && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
              <Calendar size={14} />
              <span>
                Showing tasks due{" "}
                <span className="text-black dark:text-white font-medium">
                  {new Date(calendarDate + "T00:00:00").toLocaleDateString(
                    "en",
                    { month: "long", day: "numeric" }
                  )}
                </span>
              </span>
              <button
                onClick={() => setCalendarDate(null)}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="mb-4">
            {habitsView ? (
              <HabitInput onAdd={addHabit} />
            ) : (
              <TodoInput
                onAdd={addTodo}
                tags={tags}
                lists={lists}
                activeListId={activeListId}
              />
            )}
          </div>

          {/* Mobile: list selector (below input, above tasks) */}
          <div className="md:hidden mb-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={switchToAllTasks}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                !activeListId && !habitsView
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
              }`}
            >
              All
            </button>
            <button
              onClick={switchToHabits}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                habitsView
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
              }`}
            >
              Habits
            </button>
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => switchToList(list.id)}
                className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                  activeListId === list.id
                    ? "bg-black dark:bg-white text-white dark:text-black"
                    : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
                }`}
              >
                {list.name}
              </button>
            ))}
          </div>

          {/* Content */}
          {habitsView ? (
            <HabitList
              habits={todaysHabits}
              onToggle={toggleCompletion}
              onUpdate={updateHabit}
              onDelete={deleteHabit}
              onReorder={reorderHabits}
              loading={habitsLoading}
            />
          ) : (
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
              filterDate={calendarDate}
              lists={lists}
              activeListId={activeListId}
            />
          )}
        </main>

        {/* Calendar panel — desktop only, hidden in habits view */}
        {!habitsView && showCalendar && (
          <aside className="hidden md:block w-80 flex-shrink-0 pt-4">
            <div className="sticky top-4">
              <CalendarPanel
                todos={todos}
                selectedDate={calendarDate}
                onSelectDate={setCalendarDate}
              />
            </div>
          </aside>
        )}
      </div>

      <Header email={user?.email} />
    </div>
  );
}
