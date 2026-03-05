"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Search, X, Filter, CheckSquare, Trash2, Maximize2, ChevronRight, ChevronDown } from "lucide-react";
import type { Todo, Tag, Priority, List, Event } from "@/lib/types";
import SortableItem from "./SortableItem";
import ManualSortWrapper from "./ManualSortWrapper";
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

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
  none: "bg-gray-300 dark:bg-gray-600",
};

type TimelineGroup = {
  key: string;
  label: string;
  todos: Todo[];
  events: Event[];
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

function groupByTimeline(
  todos: Todo[],
  events: Event[],
  eventTodosByEventId: Record<string, Todo[]>
): TimelineGroup[] {
  const groups: Record<string, { todos: Todo[]; events: Event[] }> = {};

  // Group standalone todos — use start_date if set, else due_date
  for (const todo of todos) {
    const key = getTimelineGroup(todo.start_date ?? todo.due_date);
    if (!groups[key]) groups[key] = { todos: [], events: [] };
    groups[key].todos.push(todo);
  }

  // Group events by the earliest start_date ?? due_date among their active tasks
  for (const event of events) {
    const tasks = eventTodosByEventId[event.id];
    if (!tasks?.length) continue;
    let bestDate: string | null = null;
    let bestScore = Infinity;
    for (const t of tasks) {
      const d = t.start_date ?? t.due_date ?? null;
      const s = getUrgencyScore(t.priority, d);
      if (s < bestScore) { bestScore = s; bestDate = d; }
    }
    const key = getTimelineGroup(bestDate);
    if (!groups[key]) groups[key] = { todos: [], events: [] };
    groups[key].events.push(event);
  }

  // Sort todos within each group by their effective date
  for (const key of Object.keys(groups)) {
    if (key !== "someday") {
      groups[key].todos.sort((a, b) => {
        const da = a.start_date ?? a.due_date ?? null;
        const db = b.start_date ?? b.due_date ?? null;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      });
    }
  }

  return TIMELINE_CONFIG
    .filter((c) => (groups[c.key]?.todos?.length ?? 0) > 0 || (groups[c.key]?.events?.length ?? 0) > 0)
    .map((c) => ({ key: c.key, label: c.label, todos: groups[c.key]?.todos ?? [], events: groups[c.key]?.events ?? [] }));
}

// Urgency score: lower = more urgent/important
function getUrgencyScore(
  priority: Priority | null | undefined,
  due_date: string | null | undefined
): number {
  const pScore = PRIORITY_ORDER[priority ?? "none"] * 100000;
  if (!due_date) return pScore + 50000; // no date = treat as mid-future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(due_date + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  // Map days into 0-49999; overdue (negative) becomes most urgent (lowest)
  return pScore + Math.max(0, Math.min(49999, days + 1000));
}

type Urgency = "overdue" | "today" | "soon" | "normal";
const URGENCY_STYLE: Record<Urgency, React.CSSProperties> = {
  overdue: { backgroundColor: "rgba(239,68,68,0.22)", color: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.45)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  today:   { backgroundColor: "rgba(245,158,11,0.22)", color: "#f59e0b", boxShadow: "0 0 8px rgba(245,158,11,0.4)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  soon:    { backgroundColor: "rgba(59,130,246,0.22)", color: "#3b82f6", boxShadow: "0 0 8px rgba(59,130,246,0.4)" },
  normal:  { backgroundColor: "rgba(255,255,255,0.1)", color: "#9ca3af" },
};
function getEventUrgency(todos: Todo[]): Urgency {
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setHours(0, 0, 0, 0);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  let best: Urgency = "normal";
  const rank = { overdue: 3, today: 2, soon: 1, normal: 0 };
  for (const t of todos) {
    if (t.completed) continue;
    if (!t.due_date) continue;
    let u: Urgency = "normal";
    if (t.due_date < todayStr) u = "overdue";
    else if (t.due_date === todayStr) u = "today";
    else { const d = new Date(t.due_date + "T00:00:00"); if (d <= weekEnd) u = "soon"; }
    if (rank[u] > rank[best]) best = u;
    if (best === "overdue") break; // can't get worse
  }
  return best;
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(y, m - 1, d);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  onUpdate: (id: string, updates: { title?: string; due_date?: string | null; start_date?: string | null; start_time?: string | null; end_time?: string | null; priority?: Priority; notes?: string | null; list_id?: string | null }) => void;
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
  onOpenEventDetail?: (eventId: string) => void;
  /** Initial sort mode. Falls back to "default" if not provided. */
  defaultSortBy?: SortBy;
  /** Key used to persist manual sort order in localStorage (e.g. "list:uuid", "allTasks"). */
  viewKey?: string;
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
  onOpenEventDetail,
  defaultSortBy = "default",
  viewKey = "default",
}: TodoListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>(defaultSortBy);
  const [showFilters, setShowFilters] = useState(false);

  // ── Manual sort order (mixed events + todos), persisted per view ──────────
  const lsKey = `manualOrder:${viewKey}`;
  const [manualOrder, setManualOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(lsKey) ?? "[]"); } catch { return []; }
  });

  function saveManualOrder(order: string[]) {
    setManualOrder(order);
    try { localStorage.setItem(lsKey, JSON.stringify(order)); } catch { /* ignore */ }
  }

  // Collapsed state for event containers (default: collapsed = true when not set)
  const [collapsedEvents, setCollapsedEvents] = useState<Record<string, boolean>>({});
  const isCollapsed = (id: string) => collapsedEvents[id] !== false;
  const toggleCollapse = (id: string) =>
    setCollapsedEvents((prev) => ({ ...prev, [id]: prev[id] !== false ? false : true }));

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

  // Return the most-urgent active task in an event
  function getEventBestTask(eventId: string): Todo | null {
    const tasks = eventTodosByEventId[eventId] ?? [];
    if (tasks.length === 0) return null;
    return tasks.reduce((best, t) =>
      getUrgencyScore(t.priority, t.due_date) < getUrgencyScore(best.priority, best.due_date)
        ? t
        : best
    );
  }

  // Merged list of events + standalone active todos, ordered by urgency
  type MergedItem =
    | { kind: "event"; event: Event; score: number }
    | { kind: "todo"; todo: Todo; score: number };

  const mergedItems = useMemo((): MergedItem[] => {
    if (sortBy === "timeline") return [];

    const items: MergedItem[] = [];

    for (const event of events) {
      const tasks = eventTodosByEventId[event.id];
      if (!tasks?.length) continue;
      // Use start_date ?? due_date for event urgency score
      const score = Math.min(
        ...tasks.map((t) => getUrgencyScore(t.priority, t.start_date ?? t.due_date))
      );
      items.push({ kind: "event", event, score });
    }

    for (const todo of standaloneActiveTodos) {
      items.push({
        kind: "todo",
        todo,
        score: getUrgencyScore(todo.priority, todo.start_date ?? todo.due_date),
      });
    }

    // For default sort: order comes from manualOrder (applied below); skip sorting here
    if (sortBy !== "default") {
      items.sort((a, b) => a.score - b.score);
    }

    return items;
  }, [events, eventTodosByEventId, standaloneActiveTodos, sortBy]);

  const hasEventItems = mergedItems.some((i) => i.kind === "event");

  // Sync new items into manualOrder (append at end, remove gone items)
  useEffect(() => {
    if (sortBy !== "default") return;
    const allIds = mergedItems.map((i) => (i.kind === "event" ? i.event.id : i.todo.id));
    const cleaned = manualOrder.filter((id) => allIds.includes(id));
    const missing = allIds.filter((id) => !cleaned.includes(id));
    if (missing.length > 0 || cleaned.length !== manualOrder.length) {
      saveManualOrder([...cleaned, ...missing]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedItems, sortBy]);

  // Final display order for default sort: follow manualOrder
  const sortedMergedItems = useMemo((): MergedItem[] => {
    if (sortBy !== "default") return mergedItems;
    return [...mergedItems].sort((a, b) => {
      const aId = a.kind === "event" ? a.event.id : a.todo.id;
      const bId = b.kind === "event" ? b.event.id : b.todo.id;
      const ai = manualOrder.indexOf(aId);
      const bi = manualOrder.indexOf(bId);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [mergedItems, manualOrder, sortBy]);

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

    if (hasEventItems) {
      // Mixed mode: update manualOrder
      const ids = sortedMergedItems.map((i) => (i.kind === "event" ? i.event.id : i.todo.id));
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        saveManualOrder(arrayMove(ids, oldIndex, newIndex));
      }
    } else {
      // Standalone-only mode: persist via sort_order to DB
      const oldIndex = todos.findIndex((t) => t.id === active.id);
      const newIndex = todos.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(todos, oldIndex, newIndex);
      onReorder(reordered);
    }
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

  // Render an event container — collapsed by default
  function renderEventContainer(event: Event) {
    const eventTodos = eventTodosByEventId[event.id] || [];
    if (eventTodos.length === 0) return null;

    const collapsed = isCollapsed(event.id);
    const activeCount = eventTodos.filter((t) => !t.completed).length;
    const doneCount = eventTodos.filter((t) => t.completed).length;
    const listName = event.list_id
      ? lists.find((l) => l.id === event.list_id)?.name
      : null;
    const bestTask = getEventBestTask(event.id);

    return (
      <div key={event.id} className="glass-card-subtle overflow-hidden">
        {/* Color accent bar */}
        <div className="h-0.5" style={{ backgroundColor: event.color ?? "#6366f1" }} />

        {/* Header */}
        <div className="p-3 md:p-4">
          <div className="flex items-start gap-2 group">
            {/* Expand/collapse toggle */}
            <button
              onClick={() => toggleCollapse(event.id)}
              className="mt-0.5 text-gray-400 hover:text-black dark:hover:text-white transition-default flex-shrink-0"
              aria-label={collapsed ? "Expand event" : "Collapse event"}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </button>

            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-black dark:text-white">
                  {event.title}
                </p>
                {/* Active task count badge — color-coded by due-date urgency */}
                {activeCount > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE[getEventUrgency(tasks)]}>
                    {activeCount}
                  </span>
                )}
                {listName && (
                  <span className="text-[11px] text-gray-300 dark:text-gray-600">
                    {listName}
                  </span>
                )}
              </div>

              {/* Best-task preview — only when collapsed */}
              {collapsed && bestTask && (
                <div className="flex items-center gap-1.5 mt-1 min-w-0">
                  {bestTask.priority && bestTask.priority !== "none" && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[bestTask.priority]}`}
                    />
                  )}
                  <span className="text-xs text-gray-400 truncate">{bestTask.title}</span>
                  {bestTask.due_date && (
                    <span className="text-xs text-gray-300 dark:text-gray-600 flex-shrink-0">
                      · {formatShortDate(bestTask.due_date)}
                    </span>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {!collapsed && eventTodos.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-0.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(doneCount / eventTodos.length) * 100}%`,
                        backgroundColor: event.color ?? "#6366f1",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {doneCount}/{eventTodos.length}
                  </span>
                </div>
              )}
            </div>

            {/* Actions (visible on hover) */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-default flex-shrink-0 mt-0.5">
              {onOpenEventDetail && (
                <button
                  onClick={() => onOpenEventDetail(event.id)}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-default p-1"
                  aria-label="Open event detail"
                  title="Open detail view"
                >
                  <Maximize2 size={13} />
                </button>
              )}
              {onDeleteEvent && (
                <button
                  onClick={() => onDeleteEvent(event.id)}
                  className="text-gray-400 hover:text-red-500 transition-default p-1"
                  aria-label="Delete event"
                  title="Delete event"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded: full task list */}
        {!collapsed && (
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
        )}
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
        /* ── Timeline view: events interleaved with tasks by start_date/due_date ── */
        <div className="space-y-5">
          {groupByTimeline(standaloneActiveTodos, events, eventTodosByEventId).map((group) => (
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
                  {group.todos.length + group.events.length}
                </span>
              </p>
              <div className="space-y-2">
                {group.events.map((event) => renderEventContainer(event))}
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
        /* ── Default / Priority view: events + tasks interleaved ── */
        <div className="space-y-2">
          {sortedMergedItems.length > 0 && (
            sortBy === "default" && !selectMode ? (
              /* Manual sort: full DnD for both events and standalone tasks */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortedMergedItems.map((i) =>
                    i.kind === "event" ? i.event.id : i.todo.id
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sortedMergedItems.map((item) =>
                      item.kind === "event" ? (
                        <ManualSortWrapper key={item.event.id} id={item.event.id}>
                          {renderEventContainer(item.event)}
                        </ManualSortWrapper>
                      ) : (
                        <ManualSortWrapper key={item.todo.id} id={item.todo.id}>
                          {renderTodo(item.todo, false)}
                        </ManualSortWrapper>
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              /* Priority sort: urgency order, no DnD */
              <div className="space-y-2">
                {sortedMergedItems.map((item) =>
                  item.kind === "event"
                    ? renderEventContainer(item.event)
                    : renderTodo(item.todo, false)
                )}
              </div>
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
