"use client";

import { useState, useMemo, useCallback } from "react";
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
import { Search, X, Filter, CheckSquare, Trash2 } from "lucide-react";
import type { Todo, Tag, Priority, List, Event } from "@/lib/types";
import SortableItem from "./SortableItem";
import TodoItem from "./TodoItem";
import ConfirmDialog from "./ConfirmDialog";
import BulkActionBar from "./BulkActionBar";

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

// ── Skeleton loader ───────────────────────────────────────────────
function TodoSkeleton() {
  return (
    <div className="glass-card-subtle p-3 md:p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-md bg-black/10 dark:bg-white/10 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-black/10 dark:bg-white/10 rounded-lg w-3/4" />
          <div className="flex gap-2">
            <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-14" />
            <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
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
  events?: Event[];
  onAssignEvent?: (todoId: string, eventId: string | null) => void;
  onDeleteEvent?: (eventId: string) => void;
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
  events = [],
  onAssignEvent,
  onDeleteEvent,
}: TodoListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const [showFilters, setShowFilters] = useState(false);

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

    if (filterDate) {
      result = result.filter((t) => t.due_date === filterDate);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.name.toLowerCase().includes(q))
      );
    }

    if (filterStatus === "active") result = result.filter((t) => !t.completed);
    if (filterStatus === "completed") result = result.filter((t) => t.completed);

    if (filterTagId) {
      result = result.filter((t) =>
        (t.tags ?? []).some((tag) => tag.id === filterTagId)
      );
    }

    if (sortBy === "priority") {
      result = [...result].sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority ?? "none"] -
          PRIORITY_ORDER[b.priority ?? "none"]
      );
    } else if (sortBy === "timeline") {
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

  // Separate event-based todos from standalone todos
  const eventTodosByEventId = useMemo(() => {
    const grouped: Record<string, Todo[]> = {};
    for (const todo of activeTodos) {
      if (todo.event_id) {
        if (!grouped[todo.event_id]) grouped[todo.event_id] = [];
        grouped[todo.event_id].push(todo);
      }
    }
    return grouped;
  }, [activeTodos]);

  const standaloneActiveTodos = activeTodos.filter((t) => !t.event_id);
  const standaloneCompletedTodos = completedTodos.filter((t) => !t.event_id);

  // Bulk actions
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkComplete = useCallback(() => {
    for (const id of selectedIds) {
      onToggle(id, true);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [selectedIds, onToggle]);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) {
      onDelete(id);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [selectedIds, onDelete]);

  const handleBulkMove = useCallback(
    (listId: string | null) => {
      for (const id of selectedIds) {
        onUpdate(id, { list_id: listId });
      }
      setSelectedIds(new Set());
      setSelectMode(false);
    },
    [selectedIds, onUpdate]
  );

  const cancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

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

  // Render an event container with full TodoItem tasks
  function renderEventContainer(event: Event) {
    const eventTodos = eventTodosByEventId[event.id] || [];
    if (eventTodos.length === 0) return null;

    const completedCount = eventTodos.filter((t) => t.completed).length;
    const listName = event.list_id
      ? lists.find((l) => l.id === event.list_id)?.name
      : null;

    return (
      <div key={event.id} className="glass-card-subtle overflow-hidden">
        {/* Color accent bar */}
        <div className="h-1" style={{ backgroundColor: event.color ?? "#6366f1" }} />

        {/* Header */}
        <div className="p-3 md:p-4 pb-2">
          <div className="flex items-center gap-3 group">
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-black dark:text-white">
                {event.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">
                  {eventTodos.length} task{eventTodos.length !== 1 ? "s" : ""}
                  {completedCount > 0 && ` · ${completedCount} done`}
                </span>
                {listName && (
                  <span className="text-xs text-gray-300 dark:text-gray-600">· {listName}</span>
                )}
              </div>
            </div>
            {onDeleteEvent && (
              <button
                onClick={() => onDeleteEvent(event.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-default p-1 flex-shrink-0"
                aria-label="Delete event"
                title="Delete event"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {eventTodos.length > 0 && (
            <div className="mt-2 w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(completedCount / eventTodos.length) * 100}%`,
                  backgroundColor: event.color ?? "#6366f1",
                }}
              />
            </div>
          )}
        </div>

        {/* Full TodoItem for each task */}
        <div className="border-t border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5">
          {eventTodos.map((todo) => (
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
              events={events}
              onAssignEvent={onAssignEvent}
            />
          ))}
        </div>
      </div>
    );
  }

  // Render a todo item with optional bulk select checkbox
  function renderTodo(todo: Todo, sortable: boolean) {
    const item = sortable ? (
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
        events={events}
        onAssignEvent={onAssignEvent}
      />
    ) : (
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
        events={events}
        onAssignEvent={onAssignEvent}
      />
    );

    if (!selectMode) return item;

    return (
      <div key={todo.id} className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selectedIds.has(todo.id)}
          onChange={() => toggleSelect(todo.id)}
          className="custom-checkbox mt-3 md:mt-4 flex-shrink-0"
          aria-label={`Select "${todo.title}"`}
        />
        <div className="flex-1 min-w-0">{item}</div>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <TodoSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Progress bar */}
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

      {/* Search + Filter + Select bar */}
      <div className="mb-4 space-y-2">
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

          {/* Bulk select toggle */}
          {totalCount > 0 && (
            <button
              onClick={() => {
                if (selectMode) cancelSelect();
                else setSelectMode(true);
              }}
              className={`glass-card-subtle p-2 transition-default ${
                selectMode
                  ? "text-black dark:text-white bg-black/5 dark:bg-white/10"
                  : "text-gray-400 hover:text-black dark:hover:text-white"
              }`}
              aria-label={selectMode ? "Cancel selection" : "Select multiple"}
              title={selectMode ? "Cancel selection" : "Select multiple"}
            >
              <CheckSquare size={14} />
            </button>
          )}

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

            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Sort by</p>
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

            {allTags.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5 font-medium">Tag</p>
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
                        setFilterTagId(filterTagId === tag.id ? null : tag.id)
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
        <div className="space-y-5">
          {/* Events section */}
          {Object.keys(eventTodosByEventId).length > 0 && (
            <div className="space-y-3">
              {events
                .filter((e) => eventTodosByEventId[e.id]?.length > 0)
                .map((event) => renderEventContainer(event))}
            </div>
          )}

          {/* Timeline groups for standalone todos */}
          {groupByTimeline(standaloneActiveTodos).map((group) => (
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
                {group.todos.map((todo) => renderTodo(todo, false))}
              </div>
            </div>
          ))}

          {standaloneCompletedTodos.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
                Done
                <span className="ml-1.5 text-gray-300 dark:text-gray-600 font-normal">
                  {standaloneCompletedTodos.length}
                </span>
              </p>
              <div className="space-y-2">
                {standaloneCompletedTodos.map((todo) => renderTodo(todo, false))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Events section */}
          {Object.keys(eventTodosByEventId).length > 0 && (
            <div className="space-y-3">
              {events
                .filter((e) => eventTodosByEventId[e.id]?.length > 0)
                .map((event) => renderEventContainer(event))}
            </div>
          )}

          {/* Standalone todos */}
          <div className="space-y-2">
            {standaloneActiveTodos.length > 0 && (
              selectMode ? (
                <div className="space-y-2">
                  {standaloneActiveTodos.map((todo) => renderTodo(todo, false))}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={standaloneActiveTodos.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {standaloneActiveTodos.map((todo) => renderTodo(todo, true))}
                    </div>
                  </SortableContext>
                </DndContext>
              )
            )}

            {standaloneCompletedTodos.length > 0 && (
              <div className="pt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Completed ({standaloneCompletedTodos.length})
                </p>
                <div className="space-y-2">
                  {standaloneCompletedTodos.map((todo) => renderTodo(todo, false))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk action floating bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onComplete={handleBulkComplete}
        onDelete={handleBulkDelete}
        onMoveToList={lists.length > 0 ? handleBulkMove : undefined}
        onCancel={cancelSelect}
        lists={lists}
      />

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
