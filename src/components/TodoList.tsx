"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Flame } from "lucide-react";
import { useI18n } from "./I18nProvider";
import TaskRow from "./TaskRow";
import ConfirmDialog from "./ConfirmDialog";
import BulkActionBar from "./BulkActionBar";
import { getToday } from "@/lib/date-helpers";
import { formatRowDate, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import type { FilterStatus, SortBy, TaskFilters } from "@/hooks/useTaskFilters";
import type { TodoUpdates } from "@/hooks/useTodos";
import type { Event, HabitOccurrence, List, Priority, Tag, Todo } from "@/lib/types";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** How many done tasks the Done group shows before it offers the rest. */
const DONE_PREVIEW = 20;

const TIMELINE_CONFIG: { key: string; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "this_week", label: "This Week" },
  { key: "upcoming", label: "Upcoming" },
  { key: "later", label: "Later" },
  { key: "someday", label: "Someday" },
];

function timelineKey(dateStr: string | null | undefined): string {
  if (!dateStr) return "someday";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "this_week";
  if (days <= 30) return "upcoming";
  return "later";
}

function naturalTitle(a: Todo, b: Todo) {
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

/** Lower is more urgent. Priority dominates, the date breaks the tie. */
function urgencyScore(priority: Priority | null | undefined, date: string | null | undefined): number {
  const p = PRIORITY_ORDER[priority ?? "none"] * 100_000;
  if (!date) return p + 50_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(date + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
  return p + Math.max(0, Math.min(49_999, days + 1000));
}

export interface TodoListProps {
  todos: Todo[];
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, updates: TodoUpdates) => void;
  onDelete: (id: string) => void;
  onTagToggle?: (todoId: string, tagId: string, add: boolean) => void;
  onReorder: (reordered: Todo[]) => void;
  onAddSubtask?: (todoId: string, title: string) => void;
  onToggleSubtask?: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask?: (todoId: string, subtaskId: string) => void;
  onCreateTag?: (name: string) => Promise<Tag | undefined>;
  onSaveAsTemplate?: (todo: Todo) => void;
  onDuplicate?: (todo: Todo) => void;
  loading: boolean;
  loadError?: boolean;
  onRetry?: () => void;

  onBulkComplete?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkUpdate?: (ids: string[], updates: { list_id?: string | null; due_date?: string | null; priority?: Priority }) => void;

  lists?: List[];
  activeListId?: string | null;
  events?: Event[];
  onOpenEventDetail?: (eventId: string) => void;

  /** Search, filter, sort and bulk select. Without it the list just shows. */
  filters?: TaskFilters;
  defaultSortBy?: SortBy;
  /** Namespaces the collapsed-group memory and the manual order. */
  viewKey?: string;
  /** Hide this timeline group's head; the view title already says it. */
  suppressGroupKey?: string;

  habits?: HabitOccurrence[];
  showHabits?: boolean;
  onToggleHabit?: (habitId: string, date: string) => void;

  highlightedTodoId?: string | null;
  selectedTodoId?: string | null;
  onSelectTodo?: (id: string) => void;
  liveTaskId?: string | null;
  onStartLiveTask?: (todoId: string) => void;
}

export default function TodoList({
  todos,
  allTags,
  onToggle,
  onUpdate,
  onDelete,
  onReorder,
  onDuplicate,
  loading,
  loadError = false,
  onRetry,
  onBulkComplete,
  onBulkDelete,
  onBulkUpdate,
  lists = [],
  activeListId,
  events = [],
  onOpenEventDetail,
  filters,
  defaultSortBy = "default",
  viewKey = "default",
  suppressGroupKey,
  habits = [],
  showHabits = false,
  onToggleHabit,
  highlightedTodoId,
  selectedTodoId,
  onSelectTodo,
  liveTaskId,
  onStartLiveTask,
}: TodoListProps) {
  const { t } = useI18n();

  const search = filters?.search ?? "";
  const status: FilterStatus = filters?.status ?? "all";
  const tagId = filters?.tagId ?? null;
  const sortBy: SortBy = filters?.sortBy ?? defaultSortBy;
  const selectMode = filters?.selectMode ?? false;
  const selectedIds = filters?.selectedIds ?? EMPTY_SET;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAllDone, setShowAllDone] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`collapsedGroups:${viewKey}`);
      setCollapsed(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
    } catch { setCollapsed(new Set()); }
    setShowAllDone(false);
  }, [viewKey]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(`collapsedGroups:${viewKey}`, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [viewKey]);

  // A task pointed at from elsewhere must not sit inside a closed group
  useEffect(() => {
    if (!highlightedTodoId) return;
    const todo = todos.find((x) => x.id === highlightedTodoId);
    if (!todo) return;
    const key = todo.completed ? "done" : timelineKey(todo.start_date ?? todo.due_date);
    setCollapsed((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, [highlightedTodoId, todos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Filter ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = todos;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          (x.notes ?? "").toLowerCase().includes(q) ||
          (x.tags ?? []).some((tag) => tag.name.toLowerCase().includes(q))
      );
    }
    if (status === "active") result = result.filter((x) => !x.completed);
    if (status === "completed") result = result.filter((x) => x.completed);
    if (tagId) result = result.filter((x) => (x.tags ?? []).some((tag) => tag.id === tagId));
    return result;
  }, [todos, search, status, tagId]);

  const sortTodos = useCallback(
    (input: Todo[]): Todo[] => {
      const out = [...input];
      if (sortBy === "alpha") out.sort(naturalTitle);
      else if (sortBy === "priority") {
        out.sort((a, b) => {
          const d = PRIORITY_ORDER[a.priority ?? "none"] - PRIORITY_ORDER[b.priority ?? "none"];
          return d !== 0 ? d : naturalTitle(a, b);
        });
      } else if (sortBy === "timeline") {
        out.sort((a, b) => {
          const da = a.start_date ?? a.due_date ?? null;
          const db = b.start_date ?? b.due_date ?? null;
          if (!da && !db) return naturalTitle(a, b);
          if (!da) return 1;
          if (!db) return -1;
          const d = da.localeCompare(db);
          return d !== 0 ? d : naturalTitle(a, b);
        });
      } else {
        // Manual order lives in sort_order, which the todos already carry
        out.sort((a, b) => {
          const d = (a.sort_order ?? 0) - (b.sort_order ?? 0);
          return d !== 0 ? d : urgencyScore(a.priority, a.start_date ?? a.due_date) - urgencyScore(b.priority, b.start_date ?? b.due_date);
        });
      }
      return out;
    },
    [sortBy]
  );

  const activeTodos = useMemo(() => filtered.filter((x) => !x.completed), [filtered]);
  const doneTodos = useMemo(() => sortTodos(filtered.filter((x) => x.completed)), [filtered, sortTodos]);

  const visibleHabits = useMemo(() => (showHabits ? habits : []), [showHabits, habits]);
  // With one day in view the date on every row would only repeat the heading
  const habitDays = useMemo(
    () => new Set(visibleHabits.map((h) => h.date)).size,
    [visibleHabits]
  );

  // ── Group ─────────────────────────────────────────────────────────────
  type Group = {
    key: string;
    label: string;
    todos: Todo[];
    /** Habits due on this group's day, listed after its tasks. */
    habits: HabitOccurrence[];
    /** "3/8" next to a project name. */
    progress?: string;
    tone?: "overdue";
    onOpen?: () => void;
  };

  const groups = useMemo((): Group[] => {
    const standalone = activeTodos.filter((x) => !x.event_id);
    const byProject = new Map<string, Todo[]>();
    for (const todo of activeTodos) {
      if (!todo.event_id) continue;
      const bucket = byProject.get(todo.event_id) ?? [];
      bucket.push(todo);
      byProject.set(todo.event_id, bucket);
    }

    const out: Group[] = [];

    if (sortBy === "timeline") {
      // A habit due today belongs under Today, next to the tasks due today,
      // not in a bucket of its own at the bottom of the list.
      const buckets: Record<string, Todo[]> = {};
      for (const todo of standalone) {
        const key = timelineKey(todo.start_date ?? todo.due_date);
        (buckets[key] ??= []).push(todo);
      }
      const habitBuckets: Record<string, HabitOccurrence[]> = {};
      for (const habit of visibleHabits) {
        (habitBuckets[timelineKey(habit.date)] ??= []).push(habit);
      }
      for (const config of TIMELINE_CONFIG) {
        const bucket = buckets[config.key];
        const habitBucket = habitBuckets[config.key];
        if (!bucket?.length && !habitBucket?.length) continue;
        out.push({
          key: config.key,
          label: config.label,
          todos: sortTodos(bucket ?? []),
          habits: habitBucket ?? [],
          tone: config.key === "overdue" ? "overdue" : undefined,
        });
      }
    } else if (standalone.length > 0) {
      // Without day groups the habits keep a section of their own
      out.push({ key: "tasks", label: "Tasks", todos: sortTodos(standalone), habits: [] });
    }

    // Projects keep their own head, with the count of what is done in them
    for (const [eventId, bucket] of byProject) {
      const event = events.find((e) => e.id === eventId);
      if (!event) continue;
      const total = todos.filter((x) => x.event_id === eventId).length;
      const done = todos.filter((x) => x.event_id === eventId && x.completed).length;
      out.push({
        key: `project:${eventId}`,
        label: event.title,
        todos: sortTodos(bucket),
        habits: [],
        progress: `${done}/${total}`,
        onOpen: onOpenEventDetail ? () => onOpenEventDetail(eventId) : undefined,
      });
    }

    return out;
  }, [activeTodos, events, todos, sortBy, sortTodos, onOpenEventDetail, visibleHabits]);

  // ── Bulk ──────────────────────────────────────────────────────────────
  const idsSelected = useMemo(() => [...selectedIds], [selectedIds]);

  const handleBulkComplete = useCallback(() => {
    if (onBulkComplete) onBulkComplete(idsSelected);
    else for (const id of idsSelected) onToggle(id, true);
    filters?.clearSelection();
  }, [idsSelected, onBulkComplete, onToggle, filters]);

  const handleBulkDeleteConfirm = useCallback(() => {
    if (onBulkDelete) onBulkDelete(idsSelected);
    else for (const id of idsSelected) onDelete(id);
    setConfirmBulkDelete(false);
    filters?.clearSelection();
  }, [idsSelected, onBulkDelete, onDelete, filters]);

  const bulkUpdate = useCallback(
    (updates: { list_id?: string | null; due_date?: string | null; priority?: Priority }) => {
      if (onBulkUpdate) onBulkUpdate(idsSelected, updates);
      else for (const id of idsSelected) onUpdate(id, updates);
      filters?.clearSelection();
    },
    [idsSelected, onBulkUpdate, onUpdate, filters]
  );

  // ── Drag ──────────────────────────────────────────────────────────────
  const dragEnabled = sortBy === "default" && !selectMode;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = todos.findIndex((x) => x.id === String(active.id));
      const to = todos.findIndex((x) => x.id === String(over.id));
      if (from === -1 || to === -1) return;
      onReorder(arrayMove(todos, from, to));
    },
    [todos, onReorder]
  );

  // ── Keyboard walk ─────────────────────────────────────────────────────
  const move = useCallback((direction: -1 | 1) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-task-row]"));
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[index + direction];
    next?.focus();
  }, []);

  const rowProps = {
    lists,
    hideList: !!activeListId,
    liveTaskId,
    selectMode,
    sortable: dragEnabled,
    onToggle,
    onRename: (id: string, title: string) => onUpdate(id, { title }),
    onDelete,
    onDuplicate,
    onSetPriority: (id: string, priority: Priority) => onUpdate(id, { priority }),
    onSetList: (id: string, listId: string | null) => onUpdate(id, { list_id: listId }),
    onStartTimer: onStartLiveTask,
    onToggleChecked: filters?.toggleSelected,
    onKeyNav: move,
    onSelect: (id: string) => onSelectTodo?.(id),
  };

  if (loading) return <ListSkeleton />;

  if (loadError) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-text-muted">{t("Tasks could not be loaded")}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-secondary mt-3">{t("Try again")}</button>
        )}
      </div>
    );
  }

  // Habits count as content: a day with only habits is not an empty day
  const nothingAtAll = todos.length === 0 && visibleHabits.length === 0;
  const nothingMatches =
    !nothingAtAll && filtered.length === 0 && visibleHabits.length === 0;

  return (
    <>
      {nothingAtAll ? (
        <div className="py-16 text-center">
          <p className="text-sm text-text-muted">{t("No tasks yet")}</p>
          <p className="text-[13px] text-text-faint mt-1">{t("Add one above to get started")}</p>
        </div>
      ) : nothingMatches ? (
        <div className="py-16 text-center">
          <p className="text-sm text-text-muted">{t("No tasks match your search")}</p>
          {filters && (
            <button onClick={filters.clear} className="btn btn-ghost mt-2">{t("Clear all filters")}</button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={todos.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div role="listbox" aria-label={t("Tasks")}>
              {groups.map((group) => {
                const single = group.key === "tasks";
                const isOpen = !collapsed.has(group.key);
                // "This Week" holds several days, so a habit row there says
                // which one. Under "Today" the date would only repeat the head.
                const spansDays =
                  new Set(group.habits.map((h) => h.date)).size > 1;
                return (
                  <div key={group.key}>
                    {!single && group.key !== suppressGroupKey && (
                      <GroupHead
                        label={group.key.startsWith("project:") ? group.label : t(group.label)}
                        count={group.todos.length + group.habits.length}
                        progress={group.progress}
                        tone={group.tone}
                        open={isOpen}
                        onToggle={() => toggleGroup(group.key)}
                        onOpen={group.onOpen}
                      />
                    )}
                    {(single || isOpen) && (
                      <>
                        {group.todos.map((todo) => (
                          <TaskRow
                            key={todo.id}
                            {...rowProps}
                            todo={todo}
                            selected={selectedTodoId === todo.id}
                            checked={selectedIds.has(todo.id)}
                            highlighted={highlightedTodoId === todo.id}
                          />
                        ))}
                        {group.habits.map((habit) => (
                          <HabitRow
                            key={`${habit.id}:${habit.date}`}
                            habit={habit}
                            showDate={spansDays}
                            onToggle={onToggleHabit}
                          />
                        ))}
                      </>
                    )}
                  </div>
                );
              })}

              {sortBy !== "timeline" && visibleHabits.length > 0 && (
                <div>
                  <GroupHead
                    label={t("Habits")}
                    count={visibleHabits.length}
                    open={!collapsed.has("habits")}
                    onToggle={() => toggleGroup("habits")}
                  />
                  {!collapsed.has("habits") &&
                    visibleHabits.map((habit) => (
                      <HabitRow
                        key={`${habit.id}:${habit.date}`}
                        habit={habit}
                        showDate={habitDays > 1}
                        onToggle={onToggleHabit}
                      />
                    ))}
                </div>
              )}

              {doneTodos.length > 0 && (
                <div>
                  <GroupHead
                    label={t("Done")}
                    count={doneTodos.length}
                    open={!collapsed.has("done")}
                    onToggle={() => toggleGroup("done")}
                  />
                  {!collapsed.has("done") && (
                    <>
                      {(showAllDone ? doneTodos : doneTodos.slice(0, DONE_PREVIEW)).map((todo) => (
                        <TaskRow
                          key={todo.id}
                          {...rowProps}
                          todo={todo}
                          selected={selectedTodoId === todo.id}
                          checked={selectedIds.has(todo.id)}
                          highlighted={highlightedTodoId === todo.id}
                        />
                      ))}
                      {!showAllDone && doneTodos.length > DONE_PREVIEW && (
                        <button onClick={() => setShowAllDone(true)} className="btn btn-ghost w-full justify-start h-8 px-3">
                          {t("Show all {n}", { n: doneTodos.length })}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        visible={selectMode}
        onComplete={handleBulkComplete}
        onDelete={() => { if (selectedIds.size > 0) setConfirmBulkDelete(true); }}
        onMoveToList={lists.length > 0 ? (listId) => bulkUpdate({ list_id: listId }) : undefined}
        onSetDueDate={(date) => bulkUpdate({ due_date: date })}
        onSetPriority={(priority) => bulkUpdate({ priority })}
        onCancel={() => filters?.clearSelection()}
        lists={lists}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title={t("Delete tasks")}
        message={t("Delete {n} selected tasks? This cannot be undone.", { n: selectedIds.size })}
        confirmLabel={t("Delete")}
        onConfirm={handleBulkDeleteConfirm}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </>
  );
}

const EMPTY_SET: Set<string> = new Set();

/* ─────────────────────────────────────────────────────────────── */

function GroupHead({
  label,
  count,
  progress,
  tone,
  open,
  onToggle,
  onOpen,
}: {
  label: string;
  count: number;
  progress?: string;
  tone?: "overdue";
  open: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  return (
    <div className={`group-head ${tone === "overdue" ? "is-overdue" : ""}`}>
      <button onClick={onToggle} className="flex items-center gap-1.5 min-w-0" aria-expanded={open}>
        {open ? <ChevronDown size={14} className="flex-none" /> : <ChevronRight size={14} className="flex-none" />}
        <span className="truncate">{label}</span>
      </button>
      {onOpen && (
        <button onClick={onOpen} className="text-xs normal-case tracking-normal text-text-faint hover:text-text-muted">
          ↗
        </button>
      )}
      <span className="group-head-count">{progress ?? count}</span>
    </div>
  );
}

function HabitRow({
  habit,
  showDate,
  onToggle,
}: {
  habit: HabitOccurrence;
  /** Only worth saying when the list covers more than one day. */
  showDate: boolean;
  onToggle?: (id: string, date: string) => void;
}) {
  const { t } = useI18n();
  const time = habit.time ? formatTime(habit.time) : null;
  return (
    <div className={`task-row ${habit.done ? "is-done" : ""}`}>
      <button
        onClick={() => onToggle?.(habit.id, habit.date)}
        className="task-circle"
        aria-label={habit.done ? t("Mark as not done") : t("Mark as done")}
        aria-pressed={habit.done}
      >
        {habit.done && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
      <span className="task-row-title">{habit.title}</span>
      <span className="task-row-meta">
        {habit.streak > 0 && (
          <span className="task-meta-item">
            <Flame size={14} />
            <span className="tabular-nums">{habit.streak}</span>
          </span>
        )}
        {time && <span className="tabular-nums">{time}</span>}
        {showDate && <span className="task-meta-date">{t(formatRowDate(habit.date))}</span>}
      </span>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="task-row animate-pulse">
          <span className="task-circle" style={{ borderColor: "var(--border)" }} />
          <span className="h-3 rounded surface-2" style={{ width: `${40 + (i % 3) * 15}%` }} />
        </div>
      ))}
    </div>
  );
}
