"use client";

import { useState, useMemo } from "react";
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
} from "@dnd-kit/sortable";
import { Search, X, Filter } from "lucide-react";
import type { Todo, Tag, Priority, List } from "@/lib/types";
import SortableItem from "./SortableItem";
import TodoItem from "./TodoItem";
import ConfirmDialog from "./ConfirmDialog";

type FilterStatus = "all" | "active" | "completed";
type SortBy = "default" | "priority" | "timeline";

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

type TimelineGroup = {
  key: string;
  label: string;
  todos: Todo[];
};

function getTimelineGroup(dateStr: string | null | undefined): string {
  if (!dateStr) return "someday";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "this_week";
  if (diffDays <= 30) return "upcoming";
  return "later";
}

const TIMELINE_CONFIG: { key: string; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "this_week", label: "This Week" },
  { key: "upcoming", label: "Upcoming" },
  { key: "later", label: "Later" },
  { key: "someday", label: "Someday" },
];

function groupByTimeline(todos: Todo[]): TimelineGroup[] {
  const groups: Record<string, Todo[]> = {};
  for (const todo of todos) {
    const key = getTimelineGroup(todo.due_date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(todo);
  }
  // Sort within each group by due_date
  for (const key of Object.keys(groups)) {
    if (key !== "someday") {
      groups[key].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    }
  }
  return TIMELINE_CONFIG
    .filter((c) => groups[c.key]?.length > 0)
    .map((c) => ({ key: c.key, label: c.label, todos: groups[c.key] }));
}

interface TodoListProps {
  todos: Todo[];
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, updates: { title?: string; due_date?: string | null; start_time?: string | null; end_time?: string | null; priority?: Priority; notes?: string | null; list_id?: string | null }) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onReorder: (reordered: Todo[]) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  loading: boolean;
  filterDate?: string | null;
  lists?: List[];
  activeListId?: string | null;
}

export default function TodoList({
  todos,
  allTags,
  onToggle,
  onUpdate,
  onDelete,
  onTagToggle,
  onReorder,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  loading,
  filterDate,
  lists = [],
  activeListId,
}: TodoListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [showFilters, setShowFilters] = useState(false);

  const deleteTitle =
    todos.find((t) => t.id === deleteId)?.title ?? "this task";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Progress bar
  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Filtered + sorted todos
  const filtered = useMemo(() => {
    let result = todos;

    // Calendar date filter
    if (filterDate) {
      result = result.filter((t) => t.due_date === filterDate);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.name.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filterStatus === "active") result = result.filter((t) => !t.completed);
    if (filterStatus === "completed") result = result.filter((t) => t.completed);

    // Tag filter
    if (filterTagId) {
      result = result.filter((t) =>
        (t.tags ?? []).some((tag) => tag.id === filterTagId)
      );
    }

    // Sort (timeline grouping is handled separately in render)
    if (sortBy === "priority") {
      result = [...result].sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority ?? "none"] -
          PRIORITY_ORDER[b.priority ?? "none"]
      );
    } else if (sortBy === "timeline") {
      // Sort by urgency order for flat filtering, grouped rendering handled below
      result = [...result].sort((a, b) => {
        const orderMap: Record<string, number> = {
          overdue: 0, today: 1, tomorrow: 2, this_week: 3, upcoming: 4, later: 5, someday: 6,
        };
        const ga = orderMap[getTimelineGroup(a.due_date)] ?? 6;
        const gb = orderMap[getTimelineGroup(b.due_date)] ?? 6;
        if (ga !== gb) return ga - gb;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    }

    return result;
  }, [todos, search, filterStatus, filterTagId, filterDate, sortBy]);

  const activeTodos = filtered.filter((t) => !t.completed);
  const completedTodos = filtered.filter((t) => t.completed);
  const hasFilters =
    search || filterStatus !== "all" || filterTagId || sortBy !== "default";

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(todos, oldIndex, newIndex);
    onReorder(reordered);
  }

  function handleDeleteRequest(id: string) {
    setDeleteId(id);
  }

  function handleDeleteConfirm() {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-gray-400/30 border-t-black dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Progress bar (only if there are todos) */}
      {totalCount > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">
              {completedCount}/{totalCount} completed
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full">
            <div
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="mb-4 space-y-2">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 glass-card-subtle px-3 py-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 bg-transparent text-sm text-black dark:text-white placeholder:text-gray-400 focus:outline-none"
              aria-label="Search tasks"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`glass-card-subtle p-2 transition-default ${
              hasFilters && !search
                ? "text-black dark:text-white"
                : "text-gray-400 hover:text-black dark:hover:text-white"
            }`}
            aria-label="Toggle filters"
          >
            <Filter size={14} />
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="glass-card-subtle p-3 space-y-3">
            {/* Status */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Status</p>
              <div className="flex gap-2">
                {(["all", "active", "completed"] as FilterStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg border capitalize transition-default ${
                        filterStatus === s
                          ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                          : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                      }`}
                    >
                      {s}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Sort */}
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">
                Sort by
              </p>
              <div className="flex gap-2">
                {(
                  [
                    ["default", "Manual"],
                    ["priority", "Priority"],
                    ["timeline", "Timeline"],
                  ] as [SortBy, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                      sortBy === val
                        ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                        : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5 font-medium">
                  Tag
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setFilterTagId(null)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                      !filterTagId
                        ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                        : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                    }`}
                  >
                    All
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() =>
                        setFilterTagId(
                          filterTagId === tag.id ? null : tag.id
                        )
                      }
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                        filterTagId === tag.id
                          ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                          : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilterStatus("all");
                  setFilterTagId(null);
                  setSortBy("default");
                }}
                className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Todo items */}
      {todos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-base">No tasks yet</p>
          <p className="text-gray-400/60 text-sm mt-1">
            Add one above to get started
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-base">No tasks match your search</p>
          <button
            onClick={() => {
              setSearch("");
              setFilterStatus("all");
              setFilterTagId(null);
            }}
            className="text-sm text-gray-400 hover:text-black dark:hover:text-white mt-2 transition-default"
          >
            Clear filters
          </button>
        </div>
      ) : sortBy === "timeline" ? (
        /* Timeline grouped view */
        <div className="space-y-5">
          {groupByTimeline(activeTodos).map((group) => (
            <div key={group.key}>
              <p className={`text-xs font-medium uppercase tracking-wider mb-2 px-1 ${
                group.key === "overdue"
                  ? "text-red-500 dark:text-red-400"
                  : group.key === "today"
                  ? "text-black dark:text-white"
                  : "text-gray-400"
              }`}>
                {group.label}
                <span className="ml-1.5 text-gray-300 dark:text-gray-600 font-normal">
                  {group.todos.length}
                </span>
              </p>
              <div className="space-y-2">
                {group.todos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    allTags={allTags}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={handleDeleteRequest}
                    onTagToggle={onTagToggle}
                    onAddSubtask={onAddSubtask}
                    onToggleSubtask={onToggleSubtask}
                    onDeleteSubtask={onDeleteSubtask}
                    lists={lists}
                    activeListId={activeListId}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Completed todos */}
          {completedTodos.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
                Done
                <span className="ml-1.5 text-gray-300 dark:text-gray-600 font-normal">
                  {completedTodos.length}
                </span>
              </p>
              <div className="space-y-2">
                {completedTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    allTags={allTags}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={handleDeleteRequest}
                    onTagToggle={onTagToggle}
                    onAddSubtask={onAddSubtask}
                    onToggleSubtask={onToggleSubtask}
                    onDeleteSubtask={onDeleteSubtask}
                    lists={lists}
                    activeListId={activeListId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Default / Priority flat view */
        <div className="space-y-2">
          {/* Active todos (sortable only when no active filter/search) */}
          {activeTodos.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {activeTodos.map((todo) => (
                    <SortableItem
                      key={todo.id}
                      todo={todo}
                      allTags={allTags}
                      onToggle={onToggle}
                      onUpdate={onUpdate}
                      onDelete={handleDeleteRequest}
                      onTagToggle={onTagToggle}
                      onAddSubtask={onAddSubtask}
                      onToggleSubtask={onToggleSubtask}
                      onDeleteSubtask={onDeleteSubtask}
                      lists={lists}
                      activeListId={activeListId}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Completed todos */}
          {completedTodos.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
                Completed ({completedTodos.length})
              </p>
              <div className="space-y-2">
                {completedTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    allTags={allTags}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={handleDeleteRequest}
                    onTagToggle={onTagToggle}
                    onAddSubtask={onAddSubtask}
                    onToggleSubtask={onToggleSubtask}
                    onDeleteSubtask={onDeleteSubtask}
                    lists={lists}
                    activeListId={activeListId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete task"
        message={`Are you sure you want to delete "${deleteTitle}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
