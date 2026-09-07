"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type Urgency } from "@/lib/urgency";
import { formatLocale } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";
import TodoInput from "@/components/TodoInput";
import TodoList from "@/components/TodoList";
import CalendarPanel from "@/components/CalendarPanel";
import TimelinePanel from "@/components/TimelinePanel";
import ScheduleWeekModal from "@/components/ScheduleWeekModal";
import HabitInput from "@/components/HabitInput";
import { useToast } from "@/components/Toast";
import KeyboardShortcutsOverlay from "@/components/KeyboardShortcutsOverlay";
import EventInput from "@/components/EventInput";
import ConfirmDialog from "@/components/ConfirmDialog";
import FocusModeView from "@/components/FocusModeView";
import RuleInput from "@/components/RuleInput";
import RuleList from "@/components/RuleList";
import TimerBar from "@/components/TimerBar";
import TimeStats from "@/components/TimeStats";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppShell from "@/components/shell/AppShell";
import SideNav from "@/components/shell/SideNav";
import ContentHeader from "@/components/shell/ContentHeader";
import NavSheet from "@/components/shell/NavSheet";
import BottomNav from "@/components/shell/BottomNav";
import JournalView from "@/components/JournalView";
import JournalSidebar from "@/components/JournalSidebar";
import HabitListView from "@/components/HabitListView";
import HabitDetail from "@/components/HabitDetail";
import HabitWeekTable from "@/components/HabitWeekTable";
import ProjectListView from "@/components/ProjectListView";
import ProjectDetail from "@/components/ProjectDetail";
import TemplateListView from "@/components/TemplateListView";
import TemplateDetail from "@/components/TemplateDetail";
import TaskDetail from "@/components/TaskDetail";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import { useLists } from "@/hooks/useLists";
import { useFolders } from "@/hooks/useFolders";
import { useHabits } from "@/hooks/useHabits";
import { useEvents } from "@/hooks/useEvents";
import { useRules } from "@/hooks/useRules";
import { useTemplates } from "@/hooks/useTemplates";
import { useJournal } from "@/hooks/useJournal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDashboardView, type ViewKind } from "@/hooks/useDashboardView";
import { useTaskFilters } from "@/hooks/useTaskFilters";
import { useToday } from "@/hooks/useToday";
import { useProfileSync } from "@/hooks/useProfileSync";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTheme } from "@/components/ThemeProvider";
import { X, CalendarRange, Target, Keyboard } from "lucide-react";
import { getToday } from "@/lib/date-helpers";
import { fetchCalendarEvents } from "@/lib/calendar-sync-client";
import type { List as ListType, Todo } from "@/lib/types";
import { isRunning } from "@/lib/running";



export default function DashboardClient({
  userId,
  email,
  serverTheme,
}: {
  userId: string;
  email?: string;
  serverTheme?: "light" | "dark" | null;
}) {
  const { t } = useI18n();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [highlightedTodoId, setHighlightedTodoId] = useState<string | null>(null);
  const [highlightedHabitId, setHighlightedHabitId] = useState<string | null>(null);
  const [showRuleInput, setShowRuleInput] = useState(false);
  // The running timer survives a reload
  const [liveTaskId, setLiveTaskId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem("liveTaskId"); } catch { return null; }
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [showScheduleWeek, setShowScheduleWeek] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // Never the default any more: the phone opens on the list like everything else
    try { return localStorage.getItem("focusModePreference") === "true"; } catch { return false; }
  });
  const [showBar, setShowBar] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("showTaskBar") !== "false"; } catch { return true; }
  });
  const { toggleTheme, theme, syncServerTheme } = useTheme();
  const router = useRouter();

  // The active view comes from the URL: back button, reload and deep links
  // all work, and switching views costs no server roundtrip
  const { view, navigate } = useDashboardView();
  // The open task travels in the URL, so a reload and the back button both
  // land on the same panel
  const selectedTodoId = view.taskId;
  const selectTodo = useCallback(
    (id: string | null) => navigate({ taskId: id }),
    [navigate]
  );
  const closeDetail = useCallback(() => navigate({ taskId: null, selId: null }), [navigate]);
  // Flips at midnight, so an open tab does not keep yesterday's "Today"
  const todayStr = useToday();
  const activeListId = view.listId;
  const activeFolderId = view.folderId;
  const calendarDates = view.dates;
  const habitsView = view.kind === "habits";
  const eventsView = view.kind === "events";
  const rulesView = view.kind === "rules";
  const journalView = view.kind === "journal";
  const timeView = view.kind === "time";
  const runningView = view.kind === "running";
  const templatesView = view.kind === "templates";
  const isTaskView =
    !eventsView && !habitsView && !rulesView && !journalView && !timeView && !templatesView;
  const quickFilter: "overdue" | "today" | "thisWeek" | null =
    view.kind === "today" ? "today"
    : view.kind === "week" ? "thisWeek"
    : view.kind === "overdue" ? "overdue"
    : null;
  const { showToast } = useToast();
  const { locale } = useI18n();
  // The reminder cron needs to know which timezone this user lives in
  useProfileSync(userId, locale);

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

  // Theme preference comes from the server render — no client auth roundtrip
  useEffect(() => {
    syncServerTheme(serverTheme ?? null, userId);
  }, [serverTheme, userId, syncServerTheme]);

  const { tags, addTag, deleteTag } = useTags(userId);
  const { lists, addList, updateList, updateListColor, deleteList, reorderLists, moveListToFolder, unassignFolder } = useLists(userId);
  const { folders, addFolder, updateFolder, deleteFolder } = useFolders(userId);
  const { entries: journalEntries, loading: journalLoading, saveEntry } = useJournal(userId);
  const {
    habits,
    todaysHabits,
    completions: habitCompletions,
    loading: habitsLoading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    skipHabitForDate,
    reorderHabits,
  } = useHabits(userId);
  const {
    todos,
    loading: todosLoading,
    loadError: todosLoadError,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    restoreTodo,
    toggleTodoTag,
    reorderTodos,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    bulkComplete,
    bulkUpdate,
    bulkDelete,
    assignTodoToEvent,
    setListForEventTodos,
    deleteTodosByEvent,
    refetchTodos,
  } = useTodos(userId, tags, activeListId, lists);

  const {
    events,
    loading: eventsLoading,
    addEvent,
    updateEvent,
    deleteEvent,
  } = useEvents(userId);

  // Events carry their tasks from the single todos fetch — no second source of
  // truth, so event tasks always show current titles, tags and subtasks
  const eventsWithTodos = useMemo(() => {
    const byEvent = new Map<string, typeof todos>();
    for (const todo of todos) {
      if (!todo.event_id) continue;
      const bucket = byEvent.get(todo.event_id);
      if (bucket) bucket.push(todo);
      else byEvent.set(todo.event_id, [todo]);
    }
    for (const bucket of byEvent.values()) {
      bucket.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    }
    return events.map((event) => ({ ...event, todos: byEvent.get(event.id) ?? [] }));
  }, [events, todos]);

  const { rules, loading: rulesLoading, addRule, updateRule, deleteRule, reorderRules } = useRules(userId);
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates(userId);

  // Push notifications
  usePushNotifications(todos);


  // Assign todo to event — the event's list is only inherited when the task
  // has none of its own; otherwise the move is offered, never forced
  const handleAssignTodoToEvent = useCallback(
    async (todoId: string, eventId: string | null) => {
      const targetEvent = eventId ? events.find((e) => e.id === eventId) : null;
      const todo = todos.find((t) => t.id === todoId);
      const eventListId = targetEvent?.list_id ?? null;
      const inherits = !!targetEvent && !!eventListId && !todo?.list_id;

      await assignTodoToEvent(todoId, eventId, inherits ? eventListId : undefined);

      if (targetEvent && eventListId && todo?.list_id && todo.list_id !== eventListId) {
        const eventListName = lists.find((l) => l.id === eventListId)?.name ?? "the event's list";
        showToast({
          message: `Task kept its own list`,
          action: {
            label: `Move to ${eventListName}`,
            onClick: () => updateTodo(todoId, { list_id: eventListId }),
          },
        });
      }
    },
    [assignTodoToEvent, events, todos, lists, updateTodo, showToast]
  );

  // Add task directly to an event — a normal task with an event_id
  const handleAddTaskToEvent = useCallback(
    async (
      eventId: string,
      title: string,
      options?: {
        due_date?: string | null;
        start_time?: string | null;
        end_time?: string | null;
        priority?: string;
        list_id?: string | null;
      }
    ) => {
      const event = events.find((e) => e.id === eventId);
      await addTodo(title, [], {
        due_date: options?.due_date ?? null,
        start_time: options?.start_time ?? null,
        end_time: options?.end_time ?? null,
        priority: (options?.priority as import("@/lib/types").Priority) ?? "none",
        list_id: options?.list_id ?? event?.list_id ?? null,
        event_id: eventId,
      });
    },
    [addTodo, events]
  );

  // Take a task out of its event without deleting it

  // Update event — when the list changes, the event's tasks follow along
  const handleUpdateEvent = useCallback(
    async (id: string, updates: Parameters<typeof updateEvent>[1]) => {
      await updateEvent(id, updates);
      if ("list_id" in updates) {
        await setListForEventTodos(id, updates.list_id ?? null);
      }
    },
    [updateEvent, setListForEventTodos]
  );

  // Open event detail from any view (list, today, this-week…)
  const handleOpenEventDetail = useCallback(
    (eventId: string) => navigate({ kind: "events", selId: eventId }),
    [navigate]
  );

  // Delete event — show confirm dialog first
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const deleteEventTitle = deleteEventId
    ? (events.find((e) => e.id === deleteEventId)?.title ?? "this project")
    : "this project";

  const handleDeleteEvent = useCallback((id: string) => {
    setDeleteEventId(id);
  }, []);

  const confirmDeleteEvent = useCallback(async () => {
    if (!deleteEventId) return;
    await deleteTodosByEvent(deleteEventId);
    await deleteEvent(deleteEventId);
    setDeleteEventId(null);
  }, [deleteEvent, deleteTodosByEvent, deleteEventId]);

  // Delete straight away and offer undo — no confirmation dialog for one task
  const handleDeleteTodo = useCallback(
    (id: string) => {
      const todo = todos.find((t) => t.id === id);
      deleteTodo(id);
      if (!todo) return;
      showToast({
        message: t('"{title}" deleted', { title: todo.title }),
        onUndo: () => restoreTodo(todo),
      });
    },
    [todos, deleteTodo, restoreTodo, showToast]
  );

  // Bring a task on screen no matter which view is active
  const revealTodo = useCallback((todoId: string) => {
    navigate({ kind: "all", listId: null, folderId: null, dates: [] });
    setHighlightedTodoId(todoId);
    setTimeout(() => {
      document
        .querySelector(`[data-todo-id="${todoId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedTodoId(null), 2500);
    }, 150);
  }, [navigate]);

  /* Would a task with this date and list show up in the view we are looking at? */
  const isVisibleHere = useCallback(
    (dueDate: string | null, listId: string | null) => {
      if (activeListId) return listId === activeListId;
      if (activeFolderId) {
        const folderListIds = new Set(
          lists.filter((l) => l.folder_id === activeFolderId).map((l) => l.id)
        );
        return !!(listId && folderListIds.has(listId));
      }
      if (calendarDates.length > 0) return !!dueDate && calendarDates.includes(dueDate);
      const today = todayStr;
      if (quickFilter === "today") return dueDate === today;
      if (quickFilter === "overdue") return !!dueDate && dueDate < today;
      if (quickFilter === "thisWeek") {
        if (!dueDate) return false;
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + 6);
        return new Date(dueDate + "T00:00:00") <= end;
      }
      if (runningView) return false; // a new task is not "running" yet
      return !eventsView && !habitsView && !rulesView && !journalView && !timeView;
    },
    [activeListId, activeFolderId, lists, calendarDates, quickFilter, eventsView, habitsView, rulesView, journalView, timeView, runningView, todayStr]
  );

  // A new task must never just vanish: highlight it, or say where it went
  const handleAddTodo = useCallback(
    async (
      title: string,
      tagIds: string[],
      options?: Parameters<typeof addTodo>[2]
    ) => {
      const newId = await addTodo(title, tagIds, options);
      if (!newId) return newId;

      const dueDate = options?.due_date ?? null;
      const listId =
        options && "list_id" in options ? options.list_id ?? null : activeListId ?? null;

      if (isVisibleHere(dueDate, listId)) {
        setHighlightedTodoId(newId);
        setTimeout(() => setHighlightedTodoId((current) => (current === newId ? null : current)), 1500);
      } else {
        showToast({
          message: dueDate ? "Task added outside this view" : 'Task added to "Someday"',
          action: { label: "Show", onClick: () => revealTodo(newId) },
        });
      }
      return newId;
    },
    [addTodo, activeListId, isVisibleHere, revealTodo, showToast]
  );

  // Turn a task into a reusable template
  const handleSaveAsTemplate = useCallback(
    (todo: Todo) => {
      addTemplate({
        name: todo.title,
        type: "task",
        data: {
          title: todo.title,
          priority: todo.priority,
          estimated_time: todo.estimated_time ?? null,
          list_id: todo.list_id ?? null,
          notes: todo.notes ?? null,
          start_time: todo.start_time ?? null,
          end_time: todo.end_time ?? null,
          subtasks: (todo.subtasks ?? []).map((s) => s.title),
        },
      });
      showToast({
        message: t('Saved "{title}" as a template', { title: todo.title }),
        action: { label: t("Open"), onClick: () => navigate({ kind: "templates" }) },
      });
    },
    [addTemplate, showToast, navigate, t]
  );

  // Completing a task is undoable too
  const handleToggleTodo = useCallback(
    (id: string, completed: boolean) => {
      toggleTodo(id, completed);
      if (!completed) return;
      const todo = todos.find((t) => t.id === id);
      showToast({
        message: todo ? t('"{title}" completed', { title: todo.title }) : t("Completed"),
        duration: 4000,
        onUndo: () => toggleTodo(id, false),
      });
    },
    [todos, toggleTodo, showToast]
  );

  /* The search field and the quick input live in child components, so both
     the shortcut and the navigation button reach them through a data hook
     rather than a selector built from a translated label. */
  const focusSearch = useCallback(() => {
    document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
  }, []);
  const focusNewTask = useCallback(() => {
    document.querySelector<HTMLInputElement>("[data-new-task-input]")?.focus();
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => {
      setShowBar(true);
      try { localStorage.setItem("showTaskBar", "true"); } catch {}
      setTimeout(() => focusNewTask(), 0);
    },
    onSearch: focusSearch,
    onToggleTheme: toggleTheme,
    onShowShortcuts: () => setShowShortcuts((prev) => !prev),
    onToggleCalendar: () => setShowCalendar((prev) => !prev),
    onToggleSchedule: () => setShowScheduleWeek((prev) => !prev),
    onNewRule: () => setShowRuleInput((prev) => !prev),
    onToggleTemplates: () => navigate({ kind: "templates" }),
    onToggleBar: () => setShowBar((prev) => {
      const next = !prev;
      try { localStorage.setItem("showTaskBar", String(next)); } catch {}
      return next;
    }),
    // Escape closes what is open — it must not make the input bar disappear
    onEscape: () => {
      setShowShortcuts(false);
      setShowScheduleWeek(false);
      setMobileSidebarOpen(false);
      setShowRuleInput(false);
    },
    enabled: !showShortcuts && !showScheduleWeek && !mobileSidebarOpen,
  });

  // Keep a ref to refetchTodos so the calendar sync effect always has the latest version
  const refetchTodosRef = useRef(refetchTodos);
  useEffect(() => { refetchTodosRef.current = refetchTodos; }, [refetchTodos]);

  // Initial Google Calendar import — once per browser session, and only after
  // the first render so it never delays the first paint. Refetches todos only
  // when the import actually wrote something.
  useEffect(() => {
    const flag = `googleImportDone:${userId}`;
    try {
      if (sessionStorage.getItem(flag)) return;
    } catch {}

    const run = () => {
      try { sessionStorage.setItem(flag, "1"); } catch {}
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setDate(start.getDate() - 7);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      end.setDate(end.getDate() + 7);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      fetchCalendarEvents(fmt(start), fmt(end)).then((result) => {
        if ((result.imported ?? 0) > 0) refetchTodosRef.current();
      });
    };

    const useIdle = typeof window.requestIdleCallback === "function";
    const handle = useIdle
      ? window.requestIdleCallback(run, { timeout: 5000 })
      : window.setTimeout(run, 3000);

    return () => {
      if (useIdle) window.cancelIdleCallback(handle as number);
      else window.clearTimeout(handle as number);
    };
  }, [userId]);

  // Sensors for list drag & drop

  // Live task stopwatch
  const liveTask = liveTaskId ? todos.find(t => t.id === liveTaskId) ?? null : null;

  const handleStartLiveTask = useCallback((todoId: string) => {
    setLiveTaskId(todoId);
  }, []);

  useEffect(() => {
    try {
      if (liveTaskId) localStorage.setItem("liveTaskId", liveTaskId);
      else localStorage.removeItem("liveTaskId");
    } catch { /* ignore */ }
  }, [liveTaskId]);

  const handleSaveLiveTime = useCallback((todoId: string, totalSeconds: number) => {
    updateTodo(todoId, { time_spent: totalSeconds });
  }, [updateTodo]);

  // Template apply handlers
  /* offset a YYYY-MM-DD string by N days */
  function offsetDate(base: string, days: number): string {
    const [y, m, d] = base.split("-").map(Number);
    const dt = new Date(y, m - 1, d + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  const handleApply = useCallback(async (
    template: import("@/lib/types").Template,
    startDate: string
  ) => {
    type TaskData = import("@/lib/types").TaskTemplateData;
    type EventData = import("@/lib/types").EventTemplateData;

    async function applyTask(data: TaskData) {
      const dueDate = startDate ? offsetDate(startDate, (data.day ?? 1) - 1) : undefined;
      const id = await addTodo(data.title, [], {
        priority: data.priority, notes: data.notes, list_id: data.list_id,
        start_time: data.start_time, end_time: data.end_time, due_date: dueDate,
      });
      if (id && data.estimated_time) await updateTodo(id, { estimated_time: data.estimated_time });
      if (id) for (const title of data.subtasks ?? []) await addSubtask(id, title);
    }

    async function applyEvent(data: EventData) {
      const eventStart = startDate ? offsetDate(startDate, (data.start_day ?? 1) - 1) : startDate;
      const eventEnd = startDate && data.end_day ? offsetDate(startDate, data.end_day - 1) : undefined;
      const event = await addEvent(data.title, {
        description: data.description ?? undefined, color: data.color ?? undefined,
        list_id: data.list_id, due_date: eventStart, end_date: eventEnd,
        start_time: data.start_time ?? undefined, end_time: data.end_time ?? undefined,
      });
      if (!event) return;
      for (const task of data.tasks ?? []) {
        const taskDate = startDate ? offsetDate(startDate, (task.day ?? 1) - 1) : eventStart;
        const todoId = await addTodo(task.title, [], {
          priority: task.priority, notes: task.notes,
          list_id: task.list_id ?? data.list_id,
          start_time: task.start_time, end_time: task.end_time,
          event_id: event.id, due_date: taskDate,
        });
        if (todoId && task.estimated_time) await updateTodo(todoId, { estimated_time: task.estimated_time });
        if (todoId) for (const title of task.subtasks ?? []) await addSubtask(todoId, title);
      }
    }

    if (template.type === "task") {
      await applyTask(template.data as TaskData);
    } else if (template.type === "event") {
      await applyEvent(template.data as EventData);
    } else {
      const plan = template.data as import("@/lib/types").PlanTemplateData;
      for (const task of plan.tasks) await applyTask(task);
      for (const evt of plan.events) await applyEvent(evt);
    }
  }, [addTodo, updateTodo, addSubtask, addEvent]);

  const switchToRules = useCallback(() => navigate({ kind: "rules" }), [navigate]);
  const switchToHabits = useCallback(() => navigate({ kind: "habits" }), [navigate]);
  const switchToEvents = useCallback(() => navigate({ kind: "events" }), [navigate]);
  const switchToAllTasks = useCallback(
    () => navigate({ kind: "all", listId: null, folderId: null, dates: [] }),
    [navigate]
  );
  const switchToList = useCallback(
    (listId: string) => navigate({ kind: "all", listId, folderId: null, dates: [] }),
    [navigate]
  );
  const switchToFolder = useCallback(
    (folderId: string) => navigate({ kind: "all", folderId, listId: null, dates: [] }),
    [navigate]
  );
  const switchToToday = useCallback(() => navigate({ kind: "today" }), [navigate]);
  const switchToThisWeek = useCallback(() => navigate({ kind: "week" }), [navigate]);
  const switchToOverdue = useCallback(() => navigate({ kind: "overdue" }), [navigate]);

  const handleCalendarDatesChange = useCallback(
    (dates: string[]) => navigate({ kind: "all", dates }),
    [navigate]
  );

  const handleTimelineTodoClick = useCallback((todoId: string) => {
    revealTodo(todoId);
  }, [revealTodo]);

  const handleTimelineHabitClick = useCallback((habitId: string) => {
    navigate({ kind: "habits" });
    setHighlightedHabitId(habitId);
    setTimeout(() => setHighlightedHabitId(null), 2200);
  }, [navigate]);

  // The task the panel shows. A stale id (deleted elsewhere, filtered away)
  // simply leaves the panel in its empty state.
  const selectedTodo = useMemo(
    () => (selectedTodoId ? todos.find((todo) => todo.id === selectedTodoId) ?? null : null),
    [todos, selectedTodoId]
  );
  const detailOpen =
    selectedTodo !== null ||
    view.selId !== null ||
    journalView ||
    (showCalendar && isTaskView);

  // Task counts for sidebar badges — computed before early returns (Rules of Hooks)
  type ListBadges = { overdue: number; today: number; thisWeek: number };

  const taskCounts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    let total = 0, today = 0, thisWeek = 0, overdue = 0;
    const listBadges: Record<string, ListBadges> = {};
    const folderBadges: Record<string, ListBadges> = {};
    let globalUrgency: Urgency = "normal";
    let thisWeekUrgency: Urgency = "normal";
    const urgencyRank = { overdue: 3, today: 2, soon: 1, normal: 0 } as const;

    for (const t of todos) {
      if (t.completed) continue;
      // Skip "someday" tasks (no due date) from all sidebar counts
      if (!t.due_date) continue;
      total++;
      const isOverdue = t.due_date < todayStr;
      const isToday = t.due_date === todayStr;
      const d = new Date(t.due_date + "T00:00:00");
      const isThisWeek = !isOverdue && !isToday && d <= weekEnd;

      // Global urgency
      const u: Urgency = isOverdue ? "overdue" : isToday ? "today" : isThisWeek ? "soon" : "normal";
      if (urgencyRank[u] > urgencyRank[globalUrgency]) globalUrgency = u;

      if (isOverdue) overdue++;
      if (isToday) today++;
      if (isThisWeek) thisWeek++;
      if (isOverdue || isToday || isThisWeek) {
        if (urgencyRank[u] > urgencyRank[thisWeekUrgency]) thisWeekUrgency = u;
      }

      // Per-list badges
      if (t.list_id) {
        if (!listBadges[t.list_id]) listBadges[t.list_id] = { overdue: 0, today: 0, thisWeek: 0 };
        if (isOverdue) listBadges[t.list_id].overdue++;
        if (isToday) listBadges[t.list_id].today++;
        if (isThisWeek) listBadges[t.list_id].thisWeek++;
      }
    }

    // Aggregate per-folder badges from per-list badges
    for (const list of lists) {
      if (!list.folder_id) continue;
      const lb = listBadges[list.id];
      if (!lb) continue;
      if (!folderBadges[list.folder_id]) folderBadges[list.folder_id] = { overdue: 0, today: 0, thisWeek: 0 };
      folderBadges[list.folder_id].overdue += lb.overdue;
      folderBadges[list.folder_id].today += lb.today;
      folderBadges[list.folder_id].thisWeek += lb.thisWeek;
    }

    const thisWeekTotal = overdue + today + thisWeek;
    return { total, today, thisWeek, thisWeekTotal, overdue, listBadges, folderBadges, globalUrgency, thisWeekUrgency };
  }, [todos, lists, todayStr]);

  // What the navigation shows on the right of each row. Open tasks only.
  const navCounts = useMemo(() => {
    const weekEnd = new Date(`${todayStr}T00:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    let today = 0, week = 0, all = 0, overdue = 0, running = 0;
    const listCounts: Record<string, number> = {};

    for (const todo of todos) {
      if (todo.completed) continue;
      all++;
      if (todo.list_id) listCounts[todo.list_id] = (listCounts[todo.list_id] ?? 0) + 1;
      if (todo.due_date) {
        if (todo.due_date < todayStr) overdue++;
        else if (todo.due_date === todayStr) today++;
        if (todo.due_date >= todayStr && todo.due_date <= weekEndStr) week++;
      }
      if (isRunning(todo, todayStr, liveTaskId)) running++;
    }
    return { today, week, all, overdue, running, lists: listCounts };
  }, [todos, todayStr, liveTaskId]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  const activeList = lists.find((l) => l.id === activeListId);

  // Todos for the three focus mode panels
  const { overdueTodos, todayTodos, thisWeekTodos } = useMemo(() => {
    const weekStart = new Date(`${todayStr}T00:00:00`);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return {
      overdueTodos: todos.filter((t) => t.due_date && t.due_date < todayStr && !t.completed),
      todayTodos: todos.filter((t) => t.due_date === todayStr),
      thisWeekTodos: todos.filter((t) => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date + "T00:00:00");
        if (d < weekStart && !t.completed) return true;
        return d >= weekStart && d <= weekEnd;
      }),
    };
  }, [todos, todayStr]);

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  // Build visible todos: start with list/folder filter, then apply quick/date
  // filters. Memoised so a keystroke somewhere else does not refilter
  // everything and hand the list a new array.
  const visibleTodos = useMemo(() => {
    let result = activeListId
      ? todos.filter((t) => t.list_id === activeListId)
      : activeFolderId
        ? (() => {
            const folderListIds = new Set(
              lists.filter((l) => l.folder_id === activeFolderId).map((l) => l.id)
            );
            return todos.filter((t) => t.list_id && folderListIds.has(t.list_id));
          })()
        : todos;

    if (calendarDates.length > 0) {
      // Calendar date selection — filter by selected days (respects active list)
      return result.filter((t) => t.due_date && calendarDates.includes(t.due_date));
    }

    if (runningView) {
      return result.filter((t) => isRunning(t, todayStr, liveTaskId));
    }

    if (quickFilter === "overdue") {
      return result.filter((t) => {
        if (t.completed) return false;
        const effectiveDate = t.due_date ?? t.start_date;
        return !!(effectiveDate && effectiveDate < todayStr);
      });
    }

    if (quickFilter === "today") {
      return result.filter((t) => t.due_date === todayStr);
    }

    if (quickFilter === "thisWeek") {
      // Next 7 days from today + any overdue incomplete tasks
      const start = new Date(`${todayStr}T00:00:00`);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      result = result.filter((t) => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date + "T00:00:00");
        if (d < start && !t.completed) return true; // overdue & not done
        return d >= start && d <= end;
      });
    }

    return result;
  }, [todos, lists, activeListId, activeFolderId, calendarDates, quickFilter, runningView, liveTaskId, todayStr]);

  // Habits to show alongside tasks — filtered by list when in list view,
  // hidden in overdue/habits/projects views
  const visibleHabits = useMemo(() => {
    if (habitsView || eventsView || journalView || timeView || runningView) return [];
    if (quickFilter === "overdue") return [];
    if (activeListId) return todaysHabits.filter((h) => h.list_id === activeListId);
    return todaysHabits;
  }, [habitsView, eventsView, journalView, timeView, runningView, quickFilter, activeListId, todaysHabits]);

  const activeTodoCount = visibleTodos.filter((t) => !t.completed).length;
  const completedTodoCount = visibleTodos.filter((t) => t.completed).length;
  const totalTodoCount = activeTodoCount + completedTodoCount;
  const progressPct = totalTodoCount > 0 ? (completedTodoCount / totalTodoCount) * 100 : 0;

  // One key per view — resets per-view UI state (sort, search, manual order)
  const viewKeyForList = activeListId
    ? `list:${activeListId}`
    : activeFolderId
      ? `folder:${activeFolderId}`
      : calendarDates.length > 0
        ? "calendar"
        : quickFilter === "today"
          ? "today"
          : quickFilter === "thisWeek"
            ? "thisWeek"
            : quickFilter === "overdue"
              ? "overdue"
              : "allTasks";

  /* What the panel shows in the views that are not about tasks */
  const selectedHabit = useMemo(
    () => (view.selId ? habits.find((h) => h.id === view.selId) ?? null : null),
    [habits, view.selId]
  );
  const selectedEvent = useMemo(
    () => (view.selId ? eventsWithTodos.find((e) => e.id === view.selId) ?? null : null),
    [eventsWithTodos, view.selId]
  );
  const selectedTemplate = useMemo(
    () => (view.selId ? templates.find((x) => x.id === view.selId) ?? null : null),
    [templates, view.selId]
  );
  const selectRow = useCallback((id: string) => navigate({ selId: id }), [navigate]);
  const [journalDay, setJournalDay] = useState<string>(() => getToday());

  /* What the content head says. One place, so the title, the count and the
     ring cannot disagree with each other. */
  const viewTitle = eventsView ? t("Projects")
    : rulesView ? t("Principles")
    : habitsView ? t("Habits")
    : journalView ? t("Journal")
    : timeView ? t("Time Tracking")
    : runningView ? t("Running")
    : calendarDates.length > 0
      ? calendarDates.length === 1
        ? new Date(calendarDates[0] + "T00:00:00").toLocaleDateString(formatLocale(), { weekday: "short", day: "numeric", month: "short" })
        : t("{n} days selected", { n: calendarDates.length })
      : quickFilter === "today" ? t("Today")
      : quickFilter === "thisWeek" ? t("This Week")
      : quickFilter === "overdue" ? t("Overdue")
      : activeList ? activeList.name
      : activeFolder ? activeFolder.name
      : t("All Tasks");

  /* Search, filter, sort and bulk select. The header owns the controls,
     the list owns the rows, so the state sits between them. */
  const taskFilters = useTaskFilters(
    viewKeyForList,
    activeListId ? "default" : "timeline"
  );

  /* A copy carries everything but the identity: same title, date, priority,
     list, project, notes and tags, no subtasks and no tracked time. */
  const handleDuplicateTodo = useCallback(
    (todo: Todo) => {
      addTodo(todo.title, (todo.tags ?? []).map((tag) => tag.id), {
        due_date: todo.due_date ?? null,
        start_date: todo.start_date ?? null,
        start_time: todo.start_time ?? null,
        end_time: todo.end_time ?? null,
        priority: todo.priority,
        notes: todo.notes ?? null,
        list_id: todo.list_id ?? null,
        event_id: todo.event_id ?? null,
      });
    },
    [addTodo]
  );

  const focusModeHandlers = {
    onAdd: handleAddTodo,
    onToggle: handleToggleTodo,
    onUpdate: updateTodo,
    onDelete: handleDeleteTodo,
    onTagToggle: toggleTodoTag,
    onReorder: reorderTodos,
    onAddSubtask: addSubtask,
    onToggleSubtask: toggleSubtask,
    onDeleteSubtask: deleteSubtask,
    onAssignEvent: handleAssignTodoToEvent,
    onDeleteEvent: handleDeleteEvent,
    onOpenEventDetail: handleOpenEventDetail,
  };

  /* The column and the phone sheet show the same navigation. Only two props
     differ: the sheet cannot collapse, and it closes after a jump. */
  const navProps = {
    view: view.kind,
    activeListId,
    activeFolderId,
    counts: navCounts,
    lists,
    folders,
    email,
    onSelectView: (kind: ViewKind) => navigate({ kind }),
    onSelectList: switchToList,
    onSelectFolder: switchToFolder,
    onOpenSearch: focusSearch,
    onSignOut: handleSignOut,
    onCreateList: (name: string) => addList(name),
    onRenameList: (id: string, name: string) => updateList(id, name),
    onSetListColor: (id: string, color: string | null) => updateListColor(id, color),
    onMoveListToFolder: (id: string, folderId: string | null) => moveListToFolder(id, folderId),
    onDeleteList: (id: string) => { deleteList(id); if (activeListId === id) switchToAllTasks(); },
    onCreateFolder: (name: string) => addFolder(name),
    onRenameFolder: (id: string, name: string) => updateFolder(id, name),
    onDeleteFolder: (id: string) => {
      deleteFolder(id, () => unassignFolder(id));
      if (activeFolderId === id) switchToAllTasks();
    },
    onReorderLists: (reordered: ListType[]) => reorderLists(reordered),
  };
  const sideNav = <SideNav {...navProps} />;
  const sideNavMobile = (
    <SideNav
      {...navProps}
      collapsible={false}
      onNavigated={() => setMobileSidebarOpen(false)}
      onEnterFocusMode={() => setFocusMode(true)}
    />
  );

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
        events={eventsWithTodos}
        onExitFocusMode={() => setFocusMode(false)}
        onCreateTag={addTag}
        {...focusModeHandlers}
      />
    )}
    <AppShell
      detailOpen={detailOpen}
      onCloseDetail={closeDetail}
      nav={sideNav}
      detail={
        <ErrorBoundary variant="panel" label={t("Details")}>
          {showCalendar && isTaskView ? (
            <>
              <div className="app-col-head">
                <h2 className="flex-1 text-base font-medium text-text">{t("Calendar")}</h2>
                <button onClick={() => setShowCalendar(false)} className="icon-btn flex-none" aria-label={t("Close")}>
                  <X size={16} />
                </button>
              </div>
              <div className="app-col-body p-4 space-y-2">
                <CalendarPanel
                  todos={todos}
                  selectedDates={calendarDates}
                  onSelectDates={handleCalendarDatesChange}
                  onGoogleEventsImported={refetchTodos}
                />
                <TimelinePanel
                  todos={todos}
                  habits={todaysHabits}
                  lists={lists}
                  events={eventsWithTodos}
                  onTodoClick={handleTimelineTodoClick}
                  onHabitClick={handleTimelineHabitClick}
                  onUpdateTodo={updateTodo}
                  weekModalOpen={showScheduleWeek}
                  onToggleWeekModal={() => setShowScheduleWeek(prev => !prev)}
                />
              </div>
            </>
          ) : habitsView ? (
            <HabitDetail
              habit={selectedHabit}
              lists={lists}
              onClose={closeDetail}
              onUpdate={updateHabit}
              onDelete={(id) => { deleteHabit(id); closeDetail(); }}
              onSkip={skipHabitForDate}
            />
          ) : eventsView ? (
            <ProjectDetail
              event={selectedEvent}
              lists={lists}
              onClose={closeDetail}
              onUpdate={handleUpdateEvent}
              onDelete={(id) => { handleDeleteEvent(id); closeDetail(); }}
              onAddTask={handleAddTaskToEvent}
              onToggleTodo={handleToggleTodo}
              onUpdateTodo={updateTodo}
              onDeleteTodo={handleDeleteTodo}
              onSelectTodo={selectTodo}
              selectedTodoId={selectedTodoId}
            />
          ) : journalView ? (
            <JournalSidebar
              entries={journalEntries}
              day={journalDay}
              onSelectDay={setJournalDay}
            />
          ) : templatesView ? (
            <TemplateDetail
              template={selectedTemplate}
              lists={lists}
              onClose={closeDetail}
              onRename={(id, name) => updateTemplate(id, { name })}
              onDelete={(id) => { deleteTemplate(id); closeDetail(); }}
              onApply={(template, startDate) => { handleApply(template, startDate); closeDetail(); }}
            />
          ) : (
            <TaskDetail
              todo={selectedTodo}
              lists={lists}
              events={eventsWithTodos}
              allTags={tags}
              onClose={closeDetail}
              onToggle={(todo) => handleToggleTodo(todo.id, !todo.completed)}
              onUpdate={updateTodo}
              onAssignProject={handleAssignTodoToEvent}
              onDelete={handleDeleteTodo}
              onDuplicate={handleDuplicateTodo}
              onSaveAsTemplate={handleSaveAsTemplate}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              onTagToggle={toggleTodoTag}
              onCreateTag={addTag}
              onStartTimer={handleStartLiveTask}
              liveTaskId={liveTaskId}
            />
          )}
        </ErrorBoundary>
      }

      content={
        <>
          <ContentHeader
            title={viewTitle}
            openCount={isTaskView ? activeTodoCount : undefined}
            titleBefore={
              activeList ? (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ background: activeList.color ?? "var(--text-faint)" }}
                />
              ) : undefined
            }
            titleAfter={
              quickFilter === "today" && totalTodoCount > 0 ? (
                <ProgressRing percent={progressPct} />
              ) : undefined
            }
            filters={isTaskView ? taskFilters : undefined}
            tags={tags}
            total={totalTodoCount}
            calendarOpen={showCalendar}
            onToggleCalendar={
              !habitsView && !eventsView && !journalView && !timeView
                ? () => setShowCalendar((prev) => !prev)
                : undefined
            }
            onOpenMenu={() => setMobileSidebarOpen(true)}
            actions={
              <>
                <button
                  onClick={() => setShowScheduleWeek((prev) => !prev)}
                  className={`icon-btn flex-none hidden md:inline-flex ${showScheduleWeek ? "icon-btn-on" : ""}`}
                  aria-label={t("Toggle week planner")}
                  title={`${t("Week planner")}  S`}
                >
                  <CalendarRange size={16} />
                </button>
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="icon-btn flex-none hidden md:inline-flex"
                  aria-label={t("Show keyboard shortcuts")}
                  title={`${t("Keyboard shortcuts")}  ?`}
                >
                  <Keyboard size={16} />
                </button>
              </>
            }
          />

        {isTaskView || eventsView || habitsView || rulesView ? (
          <div className="flex-none px-4 pt-4">
            {eventsView ? (
              <EventInput onAdd={addEvent} lists={lists} />
            ) : habitsView ? (
              <HabitInput onAdd={addHabit} lists={lists} />
            ) : rulesView ? (
              <RuleInput onAdd={(title, desc, cat) => addRule(title, desc, cat)} lists={lists} />
            ) : showBar ? (
              <TodoInput
                onAdd={handleAddTodo}
                onCreateTag={addTag}
                tags={tags}
                lists={lists}
                events={eventsWithTodos}
                activeListId={activeListId}
                placeholder={t("Add a task")}
              />
            ) : null}
          </div>
        ) : null}

        <div className="app-col-body px-4 pt-4 pb-6">
          {/* Content — a failure in one panel must not take the page */}
          <ErrorBoundary variant="panel" label={t("Tasks")}>
          {eventsView ? (
            <ProjectListView
              events={eventsWithTodos}
              selectedId={view.selId}
              onSelect={selectRow}
              loading={eventsLoading}
            />
          ) : journalView ? (
            <JournalView
              entries={journalEntries}
              loading={journalLoading}
              onSave={saveEntry}
              day={journalDay}
              onSelectDay={setJournalDay}
            />
          ) : templatesView ? (
            <TemplateListView
              templates={templates}
              selectedId={view.selId}
              onSelect={selectRow}
            />
          ) : timeView ? (
            <TimeStats todos={todos} lists={lists} />
          ) : rulesView ? (
            <RuleList
              rules={rules}
              loading={rulesLoading}
              onUpdate={updateRule}
              onDelete={deleteRule}
              onReorder={reorderRules}
            />
          ) : habitsView ? (
            <>
              <HabitListView
                habits={habits}
                todayHabitIds={todaysHabits.map((h) => h.id)}
                lists={lists}
                selectedId={view.selId}
                onSelect={selectRow}
                onToggle={toggleCompletion}
                loading={habitsLoading}
              />
              <HabitWeekTable habits={habits} completions={habitCompletions} />
            </>
          ) : (

            <TodoList
              selectedTodoId={selectedTodoId}
              onSelectTodo={selectTodo}
              key={viewKeyForList}
              todos={visibleTodos}
              allTags={tags}
              onToggle={handleToggleTodo}
              onUpdate={updateTodo}
              onDelete={handleDeleteTodo}
              onTagToggle={toggleTodoTag}
              onReorder={reorderTodos}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              onCreateTag={addTag}
              onSaveAsTemplate={handleSaveAsTemplate}
              onDuplicate={handleDuplicateTodo}
              filters={taskFilters}
              loading={todosLoading}
              loadError={todosLoadError}
              onRetry={refetchTodos}
              onBulkComplete={bulkComplete}
              onBulkDelete={bulkDelete}
              onBulkUpdate={bulkUpdate}
              lists={lists}
              activeListId={activeListId}
              events={eventsWithTodos}
              onOpenEventDetail={handleOpenEventDetail}
              defaultSortBy={
                activeListId ? "default"
                : quickFilter === "today" ? "timeline"
                : quickFilter === "thisWeek" ? "timeline"
                : "timeline"  /* allTasks default */
              }
              viewKey={viewKeyForList}
              suppressGroupKey={
                quickFilter === "today" ? "today"
                : quickFilter === "overdue" ? "overdue"
                : undefined
              }
              habits={visibleHabits}
              showHabits={visibleHabits.length > 0}
              onToggleHabit={toggleCompletion}
              highlightedTodoId={highlightedTodoId}
              onStartLiveTask={handleStartLiveTask}
              liveTaskId={liveTaskId}
            />
          )}
          </ErrorBoundary>
        </div>
        {liveTask && (
          <TimerBar
            todo={liveTask}
            onSaveTime={handleSaveLiveTime}
            onClose={() => setLiveTaskId(null)}
          />
        )}
        </>
      }
    >
      {/* Schedule week modal — independent of calendar panel */}
      {showScheduleWeek && (
        <ScheduleWeekModal
          todos={todos}
          habits={habits}
          lists={lists}
          events={eventsWithTodos}
          onTodoClick={handleTimelineTodoClick}
          onHabitClick={handleTimelineHabitClick}
          onUpdateTodo={updateTodo}
          onClose={() => setShowScheduleWeek(false)}
        />
      )}

      {/* Same navigation, as a sheet */}
      <NavSheet open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)}>
        {sideNavMobile}
      </NavSheet>

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcutsOverlay
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Confirm event deletion */}
      <ConfirmDialog
        open={deleteEventId !== null}
        title={t("Delete project")}
        message={`Are you sure you want to delete "${deleteEventTitle}" and all its tasks? This cannot be undone.`}
        onConfirm={confirmDeleteEvent}
        onCancel={() => setDeleteEventId(null)}
      />

      <BottomNav
        view={view.kind}
        onSelectView={(kind) => navigate({ kind })}
        onAdd={() => { setShowBar(true); setTimeout(() => focusNewTask(), 0); }}
        onMore={() => setMobileSidebarOpen(true)}
      />

    </AppShell>
    </>
  );
}

/** A 16 px ring instead of a progress bar: it says the same thing quietly. */
function ProgressRing({ percent }: { percent: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, percent)) / 100;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="flex-none" aria-hidden="true">
      <circle cx="8" cy="8" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
      <circle
        cx="8" cy="8" r={r} fill="none"
        stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={`${c * filled} ${c}`}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}
