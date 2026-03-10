"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import TodoInput from "@/components/TodoInput";
import TodoList from "@/components/TodoList";
import TagManager from "@/components/TagManager";
import CalendarPanel from "@/components/CalendarPanel";
import HabitInput from "@/components/HabitInput";
import HabitList from "@/components/HabitList";
import ToastContainer, { type ToastData } from "@/components/Toast";
import KeyboardShortcutsOverlay from "@/components/KeyboardShortcutsOverlay";
import ProductivityStats from "@/components/ProductivityStats";
import EventInput from "@/components/EventInput";
import EventList from "@/components/EventList";
import ConfirmDialog from "@/components/ConfirmDialog";
import MobileSidebar from "@/components/MobileSidebar";
import FocusModeView from "@/components/FocusModeView";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import { useLists } from "@/hooks/useLists";
import { useHabits } from "@/hooks/useHabits";
import { useEvents } from "@/hooks/useEvents";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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
import { Plus, Inbox, Trash2, Edit2, Check, X, Calendar, Repeat, Bell, Menu, Sun, CalendarDays, CalendarRange, Target, AlertCircle } from "lucide-react";
import { getToday } from "@/lib/date-helpers";
import type { User } from "@supabase/supabase-js";
import type { List as ListType } from "@/lib/types";

type Urgency = "overdue" | "today" | "soon" | "normal";
const URGENCY_STYLE: Record<Urgency, React.CSSProperties> = {
  overdue: { backgroundColor: "#ef4444", color: "#fff", boxShadow: "0 0 8px rgba(239,68,68,0.45)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  today:   { backgroundColor: "#f59e0b", color: "#fff", boxShadow: "0 0 8px rgba(245,158,11,0.45)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  soon:    { backgroundColor: "#3b82f6", color: "#fff", boxShadow: "0 0 6px rgba(59,130,246,0.35)" },
  normal:  { backgroundColor: "rgba(120,120,120,0.18)", color: "currentColor" },
};

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
  count = 0,
  urgency = "normal",
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
  count?: number;
  urgency?: "overdue" | "today" | "soon" | "normal";
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
      style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
      className={`group flex items-center rounded-xl border-b border-black/[0.05] dark:border-white/[0.06] transition-default ${
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
            className={`flex-1 text-sm bg-transparent focus:outline-none min-w-0 ${
              isActive ? "text-white dark:text-black" : "text-black dark:text-white"
            }`}
          />
          <button
            onClick={onSaveEdit}
            className={`transition-default ${isActive ? "text-white/60 dark:text-black/60 hover:text-white dark:hover:text-black" : "text-gray-400 hover:text-black dark:hover:text-white"}`}
          >
            <Check size={12} />
          </button>
          <button
            onClick={onCancelEdit}
            className={`transition-default ${isActive ? "text-white/60 dark:text-black/60 hover:text-white dark:hover:text-black" : "text-gray-400 hover:text-black dark:hover:text-white"}`}
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
            className={`min-w-0 flex-1 flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-default touch-none ${
              isActive
                ? "text-white dark:text-black font-medium"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            <span className="flex-1 truncate">{list.name}</span>
          </button>
          <div className="flex items-center gap-0.5 pl-0.5 opacity-0 group-hover:opacity-100 transition-default">
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
          {count > 0 && (
            <span
              className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none mr-3"
              style={URGENCY_STYLE[urgency]}
            >
              {count}
            </span>
          )}
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
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<"overdue" | "today" | "thisWeek" | null>("today");
  const [eventsView, setEventsView] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("focusModePreference");
    if (stored !== null) return stored === "true";
    return window.innerWidth < 768;
  });
  const [showBar, setShowBar] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("showTaskBar") !== "false"; } catch { return true; }
  });
  const [peekIdx, setPeekIdx] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const { toggleTheme } = useTheme();

  // Toast helpers
  const addToast = useCallback((toast: Omit<ToastData, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Persist focus mode preference
  useEffect(() => {
    try { localStorage.setItem("focusModePreference", String(focusMode)); } catch {}
  }, [focusMode]);

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
    assignTodoToEvent,
    refetchTodos,
  } = useTodos(user?.id, tags, activeListId, lists);

  const {
    events,
    loading: eventsLoading,
    addEvent,
    updateEvent,
    deleteEvent,
    addTaskToEvent,
    removeTaskFromEvent,
    reorderEvents,
    refetchEvents,
  } = useEvents(user?.id, tags);

  // Push notifications
  const { permission: notifPermission, isSubscribed: notifSubscribed, subscribe: subscribeNotifications, unsubscribe: unsubscribeNotifications } = usePushNotifications(todos);

  // Sneak peek ticker — cycles task index every 3 s
  useEffect(() => {
    const t = setInterval(() => setPeekIdx((i) => i + 1), 3000);
    return () => clearInterval(t);
  }, []);

  // Assign todo to event — inherit event's list_id, then sync both hooks
  const handleAssignTodoToEvent = useCallback(
    async (todoId: string, eventId: string | null) => {
      // When assigning to an event, apply the event's list_id to the task too
      const targetEvent = eventId ? events.find((e) => e.id === eventId) : null;
      // Only pass listId (to overwrite) when assigning TO an event; leave undefined when removing
      const listId = targetEvent ? targetEvent.list_id : undefined;
      await assignTodoToEvent(todoId, eventId, listId);
      refetchEvents();
      refetchTodos();
    },
    [assignTodoToEvent, refetchEvents, refetchTodos, events]
  );

  // Add task directly to an event — refetch todos so it appears in list/all-tasks views
  const handleAddTaskToEvent = useCallback(
    async (
      eventId: string,
      title: string,
      options?: {
        due_date?: string | null;
        start_time?: string | null;
        priority?: string;
        list_id?: string | null;
      }
    ) => {
      await addTaskToEvent(eventId, title, options);
      refetchTodos();
    },
    [addTaskToEvent, refetchTodos]
  );

  // Update event — when list changes, propagate to tasks and refresh todos state
  const handleUpdateEvent = useCallback(
    async (id: string, updates: Parameters<typeof updateEvent>[1]) => {
      await updateEvent(id, updates);
      if ("list_id" in updates) {
        refetchTodos();
      }
    },
    [updateEvent, refetchTodos]
  );

  // Open event detail from any view (list, today, this-week…)
  const [openEventDetailId, setOpenEventDetailId] = useState<string | null>(null);

  const handleOpenEventDetail = useCallback((eventId: string) => {
    switchToEvents();
    setOpenEventDetailId(eventId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Delete event — show confirm dialog first
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const deleteEventTitle = deleteEventId
    ? (events.find((e) => e.id === deleteEventId)?.title ?? "this event")
    : "this event";

  const handleDeleteEvent = useCallback((id: string) => {
    setDeleteEventId(id);
  }, []);

  const confirmDeleteEvent = useCallback(async () => {
    if (!deleteEventId) return;
    await deleteEvent(deleteEventId);
    refetchTodos();
    setDeleteEventId(null);
  }, [deleteEvent, refetchTodos, deleteEventId]);

  // Wrapped delete that shows undo toast
  const handleDeleteTodo = useCallback(
    (id: string) => {
      const todo = todos.find((t) => t.id === id);
      if (!todo) {
        deleteTodo(id);
        return;
      }
      deleteTodo(id);
      addToast({
        message: `"${todo.title}" deleted`,
      });
    },
    [todos, deleteTodo, addToast]
  );

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
    onShowShortcuts: () => setShowShortcuts((prev) => !prev),
    onToggleBar: () => setShowBar((prev) => {
      const next = !prev;
      try { localStorage.setItem("showTaskBar", String(next)); } catch {}
      return next;
    }),
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
    setEventsView(false);
    setActiveListId(null);
    setShowCalendar(false);
    setCalendarDate(null);
    setQuickFilter(null);
  }

  function switchToEvents() {
    setEventsView(true);
    setHabitsView(false);
    setActiveListId(null);
    setShowCalendar(false);
    setCalendarDate(null);
    setQuickFilter(null);
  }

  function switchToAllTasks() {
    setHabitsView(false);
    setEventsView(false);
    setActiveListId(null);
    setQuickFilter(null);
  }

  function switchToList(listId: string) {
    setHabitsView(false);
    setEventsView(false);
    setActiveListId(listId);
    setQuickFilter(null);
  }

  function handleCalendarDateSelect(date: string | null) {
    setCalendarDate(date);
    if (date) setQuickFilter(null);
  }

  function switchToToday() {
    setHabitsView(false);
    setEventsView(false);
    setActiveListId(null);
    setQuickFilter("today");
    setCalendarDate(null);
  }

  function switchToThisWeek() {
    setHabitsView(false);
    setEventsView(false);
    setActiveListId(null);
    setQuickFilter("thisWeek");
    setCalendarDate(null);
  }

  function switchToOverdue() {
    setHabitsView(false);
    setEventsView(false);
    setActiveListId(null);
    setQuickFilter("overdue");
    setCalendarDate(null);
  }

  // Task counts for sidebar badges — computed before early returns (Rules of Hooks)
  const taskCounts = useMemo(() => {
    const todayStr = getToday();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    let total = 0, today = 0, thisWeek = 0, overdue = 0;
    const lists: Record<string, number> = {};
    const listUrgency: Record<string, Urgency> = {};
    const urgencyRank = { overdue: 3, today: 2, soon: 1, normal: 0 } as const;
    let globalUrgency: Urgency = "normal";
    let thisWeekUrgency: Urgency = "normal";

    function taskUrgency(due_date: string | null | undefined): Urgency {
      if (!due_date) return "normal";
      if (due_date < todayStr) return "overdue";
      if (due_date === todayStr) return "today";
      const d = new Date(due_date + "T00:00:00");
      if (d <= weekEnd) return "soon";
      return "normal";
    }

    for (const t of todos) {
      if (t.completed) continue;
      total++;
      const u = taskUrgency(t.due_date);
      // Global urgency (All Tasks)
      if (urgencyRank[u] > urgencyRank[globalUrgency]) globalUrgency = u;
      // Per-list urgency
      if (t.list_id) {
        lists[t.list_id] = (lists[t.list_id] ?? 0) + 1;
        const prev = listUrgency[t.list_id];
        if (!prev || urgencyRank[u] > urgencyRank[prev]) {
          listUrgency[t.list_id] = u;
        }
      }
      if (t.due_date === todayStr) today++;
      if (t.due_date && t.due_date < todayStr) overdue++;
      if (t.due_date) {
        const d = new Date(t.due_date + "T00:00:00");
        if (d <= weekEnd) {
          thisWeek++;
          if (urgencyRank[u] > urgencyRank[thisWeekUrgency]) thisWeekUrgency = u;
        }
      }
    }
    return { total, today, thisWeek, overdue, lists, listUrgency, globalUrgency, thisWeekUrgency };
  }, [todos]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-6 h-6 border-2 border-gray-400/30 border-t-black dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const activeList = lists.find((l) => l.id === activeListId);

  // Todos for Focus Mode panels
  const todayStr = getToday();
  const focusWeekStart = new Date(); focusWeekStart.setHours(0, 0, 0, 0);
  const focusWeekEnd = new Date(focusWeekStart); focusWeekEnd.setDate(focusWeekStart.getDate() + 6); focusWeekEnd.setHours(23, 59, 59, 999);
  const overdueTodos = todos.filter((t) => t.due_date && t.due_date < todayStr && !t.completed);
  const todayTodos = todos.filter((t) => t.due_date === todayStr);
  const thisWeekTodos = todos.filter((t) => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date + "T00:00:00");
    if (d < focusWeekStart && !t.completed) return true;
    return d >= focusWeekStart && d <= focusWeekEnd;
  });
  const peekToday = todayTodos.filter((t) => !t.completed);
  const peekWeek = thisWeekTodos.filter((t) => !t.completed);

  // Build visible todos: start with list filter, then apply quick/date filters
  let visibleTodos = activeListId
    ? todos.filter((t) => t.list_id === activeListId)
    : todos;

  if (quickFilter === "overdue") {
    const today = getToday();
    visibleTodos = visibleTodos.filter((t) => t.due_date && t.due_date < today && !t.completed);
  } else if (quickFilter === "today") {
    const today = getToday();
    visibleTodos = visibleTodos.filter((t) => t.due_date === today);
  } else if (quickFilter === "thisWeek") {
    // Next 7 days from today + any overdue incomplete tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(today.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    visibleTodos = visibleTodos.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date + "T00:00:00");
      if (d < today && !t.completed) return true; // overdue & not done
      return d >= today && d <= end;
    });
  }

  const activeTodoCount = visibleTodos.filter((t) => !t.completed).length;
  const completedTodoCount = visibleTodos.filter((t) => t.completed).length;

  const focusModeHandlers = {
    onAdd: addTodo,
    onToggle: toggleTodo,
    onUpdate: updateTodo,
    onDelete: deleteTodo,
    onTagToggle: toggleTodoTag,
    onReorder: reorderTodos,
    onAddSubtask: addSubtask,
    onToggleSubtask: toggleSubtask,
    onDeleteSubtask: deleteSubtask,
    onAssignEvent: handleAssignTodoToEvent,
    onDeleteEvent: handleDeleteEvent,
    onOpenEventDetail: handleOpenEventDetail,
  };

  return (
    <>
    {/* Focus Mode overlay (mobile only) */}
    {isMobile && focusMode && (
      <FocusModeView
        overdueTodos={overdueTodos}
        todayTodos={todayTodos}
        thisWeekTodos={thisWeekTodos}
        loading={todosLoading}
        allTags={tags}
        lists={lists}
        events={events}
        onExitFocusMode={() => setFocusMode(false)}
        {...focusModeHandlers}
      />
    )}
    <div className="min-h-screen bg-white dark:bg-black transition-colors">
      <div className={`mx-auto px-4 pt-6 pb-8 flex gap-6 ${showCalendar ? "max-w-6xl" : "max-w-5xl"}`}>
        {/* Sidebar — lists (desktop) */}
        <aside className="hidden md:block w-52 flex-shrink-0 pt-4">
          <div className="sticky top-4">
            {/* All Tasks */}
            <button
              onClick={switchToAllTasks}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                !activeListId && !habitsView && !eventsView && !quickFilter
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Inbox size={15} />
              <span className="flex-1 text-left">All Tasks</span>
              {taskCounts.total > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE[taskCounts.globalUrgency]}>
                  {taskCounts.total}
                </span>
              )}
            </button>

            {/* Overdue */}
            <button
              onClick={switchToOverdue}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                quickFilter === "overdue"
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <AlertCircle size={15} />
              <span className="flex-1 text-left">Overdue</span>
              {taskCounts.overdue > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE["overdue"]}>
                  {taskCounts.overdue}
                </span>
              )}
            </button>
            {overdueTodos.length > 0 && (
              <div className="px-4 -mt-0.5 mb-1 overflow-hidden h-[14px]">
                <div key={`od-${peekIdx}`} className="peek-ticker flex items-center gap-1.5 min-w-0">
                  <span className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-none">
                    {overdueTodos[peekIdx % overdueTodos.length].title}
                  </span>
                </div>
              </div>
            )}

            {/* Today */}
            <button
              onClick={switchToToday}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                quickFilter === "today"
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Sun size={15} />
              <span className="flex-1 text-left">Today</span>
              {taskCounts.today > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE["today"]}>
                  {taskCounts.today}
                </span>
              )}
            </button>
            {peekToday.length > 0 && (
              <div className="px-4 -mt-0.5 mb-1 overflow-hidden h-[14px]">
                <div key={`td-${peekIdx}`} className="peek-ticker flex items-center gap-1.5 min-w-0">
                  <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-none">
                    {peekToday[peekIdx % peekToday.length].title}
                  </span>
                </div>
              </div>
            )}

            {/* This Week */}
            <button
              onClick={switchToThisWeek}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                quickFilter === "thisWeek"
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <CalendarDays size={15} />
              <span className="flex-1 text-left">This Week</span>
              {taskCounts.thisWeek > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE[taskCounts.thisWeekUrgency]}>
                  {taskCounts.thisWeek}
                </span>
              )}
            </button>
            {peekWeek.length > 0 && (
              <div className="px-4 -mt-0.5 mb-1 overflow-hidden h-[14px]">
                <div key={`wk-${peekIdx}`} className="peek-ticker flex items-center gap-1.5 min-w-0">
                  <span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-none">
                    {peekWeek[peekIdx % peekWeek.length].title}
                  </span>
                </div>
              </div>
            )}

            {/* Events */}
            <button
              onClick={switchToEvents}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-default mb-1 ${
                eventsView
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <CalendarRange size={15} />
              Events
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
                          count={taskCounts.lists[list.id] ?? 0}
                          urgency={taskCounts.listUrgency[list.id] ?? "normal"}
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

            {/* Tag Manager */}
            <div className="mt-6 pt-4 border-t border-black/5 dark:border-white/5 px-1">
              <TagManager tags={tags} onAdd={addTag} onDelete={deleteTag} />
            </div>

            {/* Productivity Stats */}
            <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5 px-1">
              <ProductivityStats todos={todos} />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-4">
          {/* Stats + calendar toggle + notification bell + mobile menu */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-1.5 -ml-1.5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>

              <div className="flex items-baseline gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-black dark:text-white">
                  {eventsView
                    ? "Events"
                    : habitsView
                      ? "Habits"
                      : quickFilter === "today"
                        ? "Today"
                        : quickFilter === "thisWeek"
                          ? "This Week"
                          : activeList
                            ? activeList.name
                            : "All Tasks"}
                </h2>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  {eventsView ? (
                    <span>{events.length} event{events.length !== 1 ? "s" : ""}</span>
                  ) : habitsView ? (
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
            </div>

            <div className="flex items-center gap-2">
              {/* Notification bell */}
              {!habitsView && !eventsView && (
                <button
                  onClick={notifSubscribed ? unsubscribeNotifications : subscribeNotifications}
                  className={`hidden md:flex w-10 h-10 rounded-xl glass-card-subtle items-center justify-center transition-default ${
                    notifSubscribed
                      ? "text-green-500 dark:text-green-400 hover:text-red-500 dark:hover:text-red-400"
                      : "text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                  aria-label={notifSubscribed ? "Disable notifications" : "Enable notifications"}
                  title={notifSubscribed ? "Notifications on — click to disable" : "Enable task reminders"}
                  disabled={notifPermission === "denied"}
                >
                  <Bell size={18} />
                </button>
              )}

              {/* Calendar toggle */}
              {!habitsView && !eventsView && (
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
          </div>

          {/* Quick filter indicator */}
          {!habitsView && !eventsView && quickFilter && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
              {quickFilter === "today" ? <Sun size={14} /> : <CalendarDays size={14} />}
              <span>
                Showing tasks due{" "}
                <span className="text-black dark:text-white font-medium">
                  {quickFilter === "today" ? "today" : "this week"}
                </span>
                {visibleTodos.length === 0 && (
                  <span className="ml-1">— no tasks found</span>
                )}
              </span>
              <button
                onClick={() => setQuickFilter(null)}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Calendar date filter indicator */}
          {!habitsView && !eventsView && calendarDate && (
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
          {(eventsView || habitsView || showBar) && (
            <div className="mb-4">
              {eventsView ? (
                <EventInput onAdd={addEvent} lists={lists} />
              ) : habitsView ? (
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
          )}

          {/* Mobile: list selector (below input, above tasks) */}
          <div className="md:hidden mb-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={switchToAllTasks}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                !activeListId && !habitsView && !eventsView && !quickFilter
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
              }`}
            >
              All
            </button>
            <button
              onClick={switchToOverdue}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "overdue"
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
              }`}
            >
              Overdue
            </button>
            <button
              onClick={switchToToday}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "today"
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
              }`}
            >
              Today
            </button>
            <button
              onClick={switchToThisWeek}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "thisWeek"
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
              }`}
            >
              This Week
            </button>
            <button
              onClick={switchToEvents}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                eventsView
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
              }`}
            >
              Events
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
            <button
              onClick={() => setFocusMode(true)}
              className="flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default text-gray-500 dark:text-gray-400 border border-black/15 dark:border-white/15"
            >
              Focus
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
          {eventsView ? (
            <EventList
              events={events}
              lists={lists}
              allTags={tags}
              loading={eventsLoading}
              onUpdate={handleUpdateEvent}
              onDelete={handleDeleteEvent}
              onAddTask={handleAddTaskToEvent}
              onRemoveTask={removeTaskFromEvent}
              onToggleTodo={toggleTodo}
              onUpdateTodo={updateTodo}
              onDeleteTodo={deleteTodo}
              onTagToggle={toggleTodoTag}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              onAssignEvent={handleAssignTodoToEvent}
              onRefetchEvents={refetchEvents}
              onReorderEvents={reorderEvents}
              defaultSelectedEventId={openEventDetailId}
              onDefaultEventHandled={() => setOpenEventDetailId(null)}
            />
          ) : habitsView ? (
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
              todos={visibleTodos}
              allTags={tags}
              onToggle={toggleTodo}
              onUpdate={updateTodo}
              onDelete={handleDeleteTodo}
              onTagToggle={toggleTodoTag}
              onReorder={reorderTodos}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              loading={todosLoading}
              filterDate={calendarDate}
              lists={lists}
              activeListId={activeListId}
              events={events}
              onAssignEvent={handleAssignTodoToEvent}
              onDeleteEvent={handleDeleteEvent}
              onOpenEventDetail={handleOpenEventDetail}
              defaultSortBy={
                activeListId ? "default"
                : quickFilter === "today" ? "timeline"
                : quickFilter === "thisWeek" ? "timeline"
                : "timeline"  /* allTasks default */
              }
              viewKey={
                activeListId ? `list:${activeListId}`
                : quickFilter === "today" ? "today"
                : quickFilter === "thisWeek" ? "thisWeek"
                : "allTasks"
              }
              showBar={showBar}
              onToggleBar={() => setShowBar((prev) => {
                const next = !prev;
                try { localStorage.setItem("showTaskBar", String(next)); } catch {}
                return next;
              })}
            />
          )}
        </main>

        {/* Calendar panel — desktop only */}
        {!habitsView && !eventsView && showCalendar && (
          <aside className="hidden md:block w-80 flex-shrink-0 pt-4">
            <div className="sticky top-4">
              <CalendarPanel
                todos={todos}
                selectedDate={calendarDate}
                onSelectDate={handleCalendarDateSelect}
              />
            </div>
          </aside>
        )}
      </div>

      <Header email={user?.email} />

      {/* Mobile sidebar drawer */}
      <MobileSidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        lists={lists}
        activeListId={activeListId}
        habitsView={habitsView}
        eventsView={eventsView}
        quickFilter={quickFilter}
        onSwitchToAll={switchToAllTasks}
        onSwitchToEvents={switchToEvents}
        onSwitchToHabits={switchToHabits}
        onSwitchToList={switchToList}
        onSwitchToToday={switchToToday}
        onSwitchToThisWeek={switchToThisWeek}
        onAddList={() => setShowNewList(true)}
        tags={tags}
        onAddTag={addTag}
        onDeleteTag={deleteTag}
        todos={todos}
      />

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcutsOverlay
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Confirm event deletion */}
      <ConfirmDialog
        open={deleteEventId !== null}
        title="Delete event"
        message={`Are you sure you want to delete "${deleteEventTitle}" and all its tasks? This cannot be undone.`}
        onConfirm={confirmDeleteEvent}
        onCancel={() => setDeleteEventId(null)}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Floating Focus button (mobile only, when not in focus mode) */}
      {isMobile && !focusMode && (
        <button
          onClick={() => setFocusMode(true)}
          className="md:hidden fixed bottom-8 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
          aria-label="Enter focus mode"
          title="Focus Mode"
        >
          <Target size={18} />
        </button>
      )}
    </div>
    </>
  );
}
