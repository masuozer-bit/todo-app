"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { formatLocale } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";
import Header from "@/components/Header";
import TodoInput from "@/components/TodoInput";
import TodoList from "@/components/TodoList";
import CalendarPanel from "@/components/CalendarPanel";
import TimelinePanel from "@/components/TimelinePanel";
import ScheduleWeekModal from "@/components/ScheduleWeekModal";
import HabitInput from "@/components/HabitInput";
import HabitList from "@/components/HabitList";
import { useToast } from "@/components/Toast";
import KeyboardShortcutsOverlay from "@/components/KeyboardShortcutsOverlay";
import EventInput from "@/components/EventInput";
import EventList from "@/components/EventList";
import ConfirmDialog from "@/components/ConfirmDialog";
import MobileSidebar from "@/components/MobileSidebar";
import FocusModeView from "@/components/FocusModeView";
import RuleInput from "@/components/RuleInput";
import RuleList from "@/components/RuleList";
import LiveTaskBar from "@/components/LiveTaskBar";
import TimeStats from "@/components/TimeStats";
import TemplatesModal from "@/components/TemplatesModal";
import TagManager from "@/components/TagManager";
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import { useLists } from "@/hooks/useLists";
import { useFolders } from "@/hooks/useFolders";
import { useHabits } from "@/hooks/useHabits";
import { useEvents } from "@/hooks/useEvents";
import { useRules } from "@/hooks/useRules";
import { useTemplates } from "@/hooks/useTemplates";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDashboardView } from "@/hooks/useDashboardView";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTheme } from "@/components/ThemeProvider";
import LavaLampBackground from "@/components/LavaLampBackground";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
import { Plus, Inbox, Trash2, Edit2, Check, X, Repeat, Menu, Sun, CalendarDays, CalendarRange, Target, AlertCircle, FolderPlus, Folder, Shield, Palette, Clock, ChevronRight, LayoutTemplate, Keyboard } from "lucide-react";
import { getToday } from "@/lib/date-helpers";
import { fetchCalendarEvents } from "@/lib/calendar-sync-client";
import type { List as ListType, Folder as FolderType, Todo } from "@/lib/types";

type Urgency = "overdue" | "today" | "soon" | "normal";
const URGENCY_STYLE: Record<Urgency, React.CSSProperties> = {
  overdue: { backgroundColor: "rgba(239,68,68,0.18)", color: "#f87171", backdropFilter: "blur(8px)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  today:   { backgroundColor: "rgba(245,158,11,0.18)", color: "#fbbf24", backdropFilter: "blur(8px)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  soon:    { backgroundColor: "rgba(59,130,246,0.16)", color: "#60a5fa", backdropFilter: "blur(8px)" },
  normal:  { backgroundColor: "rgba(120,120,120,0.12)", color: "rgba(180,180,180,0.9)" },
};


function ColorPickerPopover({ color, onChange, onClose }: { color?: string | null; onChange: (c: string | null) => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="absolute z-50 top-full left-0 mt-1 p-2 rounded-xl glass-card-raised flex items-center gap-2 w-auto" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <input
        type="color"
        value={color || "#60a5fa"}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/30"
        title={t("Pick a color")}
      />
      <button
        onClick={() => { onChange(null); onClose(); }}
        className="w-8 h-8 rounded-lg border-2 border-white/20 flex items-center justify-center transition-default hover:border-white/50"
        style={{ background: "rgba(120,120,120,0.3)" }}
        title={t("Remove color")}
      >
        <X size={12} className="text-white/60" />
      </button>
    </div>
  );
}

function SortableListItem({
  list,
  isActive,
  onSelect,
  badges = { overdue: 0, today: 0, thisWeek: 0 },
}: {
  list: ListType;
  isActive: boolean;
  onSelect: () => void;
  badges?: { overdue: number; today: number; thisWeek: number };
}) {
  const { t } = useI18n();
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
      {...attributes}
      style={{ ...style, opacity: isDragging ? 0.4 : 1 }}
      className={`group relative flex items-center rounded-xl transition-default border ${
        isActive
          ? "glass-nav-active font-medium"
          : "border-transparent text-black dark:text-white glass-nav-hover"
      }`}
    >
      <button
            {...listeners}
            onClick={onSelect}
            className={`min-w-0 flex-1 flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-default touch-none cursor-grab active:cursor-grabbing ${
              isActive
                ? "text-white font-medium"
                : "text-black dark:text-white"
            }`}
          >
            {list.color ? (
              <span className="flex-1 truncate">
                <span className="font-semibold" style={{ color: list.color }}>{list.name.charAt(0)}</span>
                {list.name.slice(1)}
              </span>
            ) : (
              <span className="flex-1 truncate">{list.name}</span>
            )}
          </button>
          {(badges.overdue > 0 || badges.today > 0 || badges.thisWeek > 0) && (
            <div className="flex items-center gap-0.5 flex-shrink-0 mr-3">
              {badges.overdue > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.overdue}>
                  {badges.overdue}
                </span>
              )}
              {badges.today > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.today}>
                  {badges.today}
                </span>
              )}
              {badges.thisWeek > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.soon}>
                  {badges.thisWeek}
                </span>
              )}
            </div>
          )}
    </div>
  );
}

function FolderGroup({
  folder,
  folderLists,
  isActive,
  isCollapsed,
  onToggleCollapse,
  onSelect,
  isEditing,
  editFolderName,
  setEditFolderName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  badges = { overdue: 0, today: 0, thisWeek: 0 },
  activeListId,
  onSelectList,
  listBadges,
}: {
  folder: FolderType;
  folderLists: ListType[];
  isActive: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
  isEditing: boolean;
  editFolderName: string;
  setEditFolderName: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  badges?: { overdue: number; today: number; thisWeek: number };
  activeListId: string | null;
  onSelectList: (id: string) => void;
  listBadges: Record<string, { overdue: number; today: number; thisWeek: number }>;
}) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: `folder-drop-${folder.id}` });

  return (
    <div className="rounded-xl">
      {/* Folder header — droppable target for assigning lists to this folder */}
      <div
        ref={setNodeRef}
        className={`group flex items-center gap-1 px-1.5 py-1.5 rounded-lg text-sm transition-default border ${
          isOver ? "ring-1 ring-black/25 dark:ring-white/25" : ""
        } ${
          isActive
            ? "glass-nav-active font-medium"
            : "border-transparent text-black dark:text-white glass-nav-hover"
        }`}
      >
        <button
          onClick={onToggleCollapse}
          className={`flex-shrink-0 transition-default ${isActive ? "text-white/70" : "text-gray-400"}`}
          aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
        >
          <Folder size={13} className={`transition-transform duration-200 ${isCollapsed ? "" : "scale-110"}`} />
        </button>
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editFolderName}
            onChange={(e) => setEditFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className={`flex-1 text-sm bg-transparent focus:outline-none min-w-0 ${isActive ? "text-white" : "text-black dark:text-white"}`}
          />
        ) : (
          <button onClick={onSelect} className="flex-1 text-left truncate text-sm min-w-0">
            {folder.name}
          </button>
        )}
        {isEditing ? (
          <div className="flex items-center gap-0.5">
            <button onClick={onSaveEdit} className={`p-1 rounded transition-default ${isActive ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`}><Check size={11} /></button>
            <button onClick={onCancelEdit} className={`p-1 rounded transition-default ${isActive ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`}><X size={11} /></button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-default">
              <button onClick={onStartEdit} className={`p-1 rounded transition-default ${isActive ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`} aria-label={t("Rename folder")}><Edit2 size={10} /></button>
              <button onClick={onDelete} className={`p-1 rounded transition-default ${isActive ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`} aria-label={t("Delete folder")}><Trash2 size={10} /></button>
            </div>
            {(badges.overdue > 0 || badges.today > 0 || badges.thisWeek > 0) && (
              <div className="flex items-center gap-0.5 flex-shrink-0 mr-3">
                {badges.overdue > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.overdue}>{badges.overdue}</span>
                )}
                {badges.today > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.today}>{badges.today}</span>
                )}
                {badges.thisWeek > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.soon}>{badges.thisWeek}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lists inside folder */}
      {!isCollapsed && (
        <div className="ml-4 mt-0.5 pl-2 border-l border-black/[0.08] dark:border-white/[0.08] space-y-0.5">
          {folderLists.map((list) => (
            <SortableListItem
              key={list.id}
              list={list}
              isActive={activeListId === list.id}
              onSelect={() => onSelectList(list.id)}
              badges={listBadges[list.id] ?? { overdue: 0, today: 0, thisWeek: 0 }}
            />
          ))}
          {folderLists.length === 0 && (
            <p className="text-[11px] text-gray-300 dark:text-gray-600 px-1 py-1">{t("Drop lists here")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function UngroupedDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "ungrouped-drop" });
  return (
    <div ref={setNodeRef} className={`transition-default rounded-lg ${isOver ? "ring-1 ring-black/20 dark:ring-white/20 bg-black/[0.02] dark:bg-white/[0.03]" : ""}`}>
      {children}
    </div>
  );
}

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
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState("");
  const [showListColorPicker, setShowListColorPicker] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [showHabitsInTasks, setShowHabitsInTasks] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("showHabitsInTasks") === "true"; } catch { return false; }
  });
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
  const [showTimeStats, setShowTimeStats] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showScheduleWeek, setShowScheduleWeek] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
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
  const { toggleTheme, theme, tint, lavaLamp, lavaColor, lavaOpacity, syncServerTheme } = useTheme();

  // The active view comes from the URL: back button, reload and deep links
  // all work, and switching views costs no server roundtrip
  const { view, navigate } = useDashboardView();
  const activeListId = view.listId;
  const activeFolderId = view.folderId;
  const calendarDates = view.dates;
  const habitsView = view.kind === "habits";
  const eventsView = view.kind === "events";
  const rulesView = view.kind === "rules";
  const quickFilter: "overdue" | "today" | "thisWeek" | null =
    view.kind === "today" ? "today"
    : view.kind === "week" ? "thisWeek"
    : view.kind === "overdue" ? "overdue"
    : null;
  const openEventDetailId = view.eventId;
  const { showToast } = useToast();

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
    reorderEvents,
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
  const handleRemoveTaskFromEvent = useCallback(
    (_eventId: string, todoId: string) => {
      assignTodoToEvent(todoId, null);
    },
    [assignTodoToEvent]
  );

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
    (eventId: string) => navigate({ kind: "events", eventId }),
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
      const today = getToday();
      if (quickFilter === "today") return dueDate === today;
      if (quickFilter === "overdue") return !!dueDate && dueDate < today;
      if (quickFilter === "thisWeek") {
        if (!dueDate) return false;
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + 6);
        return new Date(dueDate + "T00:00:00") <= end;
      }
      return !eventsView && !habitsView && !rulesView;
    },
    [activeListId, activeFolderId, lists, calendarDates, quickFilter, eventsView, habitsView, rulesView]
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
        setTimeout(() => setHighlightedTodoId(null), 2000);
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
        action: { label: "Open", onClick: () => setShowTemplates(true) },
      });
    },
    [addTemplate, showToast]
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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => {
      setShowBar(true);
      try { localStorage.setItem("showTaskBar", "true"); } catch {}
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label={t("New task title")}]'
        );
        input?.focus();
      }, 0);
    },
    onSearch: () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label={t("Search tasks")}]'
      );
      input?.focus();
    },
    onToggleTheme: toggleTheme,
    onShowShortcuts: () => setShowShortcuts((prev) => !prev),
    onToggleCalendar: () => setShowCalendar((prev) => !prev),
    onToggleSchedule: () => setShowScheduleWeek((prev) => !prev),
    onNewRule: () => setShowRuleInput((prev) => !prev),
    onToggleTemplates: () => setShowTemplates((prev) => !prev),
    onToggleBar: () => setShowBar((prev) => {
      const next = !prev;
      try { localStorage.setItem("showTaskBar", String(next)); } catch {}
      return next;
    }),
    // Escape closes what is open — it must not make the input bar disappear
    onEscape: () => {
      setShowShortcuts(false);
      setShowTemplates(false);
      setShowScheduleWeek(false);
      setMobileSidebarOpen(false);
      setShowRuleInput(false);
    },
    enabled: !showTemplates && !showShortcuts && !showScheduleWeek && !mobileSidebarOpen,
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
  const listSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleListDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const overId = String(over.id);
    const activeListItem = lists.find((l) => l.id === String(active.id));

    // Drop onto a folder header — only move if it's a different folder
    if (overId.startsWith("folder-drop-")) {
      const targetFolderId = overId.replace("folder-drop-", "");
      if (activeListItem?.folder_id !== targetFolderId) {
        moveListToFolder(String(active.id), targetFolderId);
      }
      return;
    }
    // Drop onto the ungrouped zone
    if (overId === "ungrouped-drop") {
      if (activeListItem?.folder_id != null) {
        moveListToFolder(String(active.id), null);
      }
      return;
    }
    // Drop onto another list item
    const overList = lists.find((l) => l.id === overId);
    const folderChanged = overList && activeListItem &&
      (overList.folder_id ?? null) !== (activeListItem.folder_id ?? null);

    if (folderChanged) {
      // Folder assignment changed — only do the folder move, skip reorder
      // (reorderLists would overwrite the new folder_id with stale state)
      moveListToFolder(String(active.id), overList!.folder_id ?? null);
      return;
    }
    // Same folder — normal reorder
    const oldIndex = lists.findIndex((l) => l.id === active.id);
    const newIndex = lists.findIndex((l) => l.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(lists, oldIndex, newIndex);
      reorderLists(reordered);
    }
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

  async function handleAddFolder(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    await addFolder(trimmed);
    setNewFolderName("");
    setShowNewFolder(false);
  }

  async function handleUpdateFolder(id: string) {
    const trimmed = editFolderName.trim();
    if (trimmed) await updateFolder(id, trimmed);
    setEditingFolderId(null);
    setEditFolderName("");
  }

  // Task counts for sidebar badges — computed before early returns (Rules of Hooks)
  type ListBadges = { overdue: number; today: number; thisWeek: number };
  const emptyBadges: ListBadges = { overdue: 0, today: 0, thisWeek: 0 };

  const taskCounts = useMemo(() => {
    const todayStr = getToday();
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
  }, [todos, lists]);

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

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  // Build visible todos: start with list/folder filter, then apply quick/date filters
  let visibleTodos = activeListId
    ? todos.filter((t) => t.list_id === activeListId)
    : activeFolderId
      ? (() => {
          const folderListIds = new Set(lists.filter((l) => l.folder_id === activeFolderId).map((l) => l.id));
          return todos.filter((t) => t.list_id && folderListIds.has(t.list_id));
        })()
      : todos;

  if (calendarDates.length > 0) {
    // Calendar date selection — filter by selected days (respects active list)
    visibleTodos = visibleTodos.filter((t) => t.due_date && calendarDates.includes(t.due_date));
  } else if (quickFilter === "overdue") {
    const today = getToday();
    visibleTodos = visibleTodos.filter((t) => {
      if (t.completed) return false;
      const effectiveDate = t.due_date ?? t.start_date;
      return !!(effectiveDate && effectiveDate < today);
    });
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

  // Habits to show alongside tasks — filtered by list when in list view,
  // hidden in overdue/habits/events views
  const visibleHabits = (() => {
    if (habitsView || eventsView || quickFilter === "overdue") return [];
    if (activeListId) {
      return todaysHabits.filter((h) => h.list_id === activeListId);
    }
    return todaysHabits;
  })();

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

  return (
    <>
    {/* Lava lamp animated background (dark mode only) */}
    {theme === "dark" && lavaLamp && <LavaLampBackground tint={lavaColor} opacity={lavaOpacity} />}

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
    <div className="h-screen overflow-hidden transition-colors relative" style={{ zIndex: 1 }}>
      <div className={`mx-auto px-4 pt-6 pb-0 flex gap-6 h-full ${!habitsView && !eventsView ? "max-w-[1380px]" : "max-w-5xl"}`}>
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex md:flex-col w-48 flex-shrink-0 pt-4 overflow-y-auto overflow-x-hidden pb-4" style={{ maxHeight: "calc(100vh - 24px)" }}>
          <div className="space-y-2">

            {/* Smart views pill */}
            <div className="glass-card px-2 py-2 space-y-0.5">
              <button onClick={switchToAllTasks} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${!activeListId && !habitsView && !eventsView && !quickFilter ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <Inbox size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{t("All Tasks")}</span>
                {(taskCounts.overdue > 0 || taskCounts.today > 0 || taskCounts.thisWeek > 0) && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {taskCounts.overdue > 0 && <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.overdue}>{taskCounts.overdue}</span>}
                    {taskCounts.today > 0 && <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.today}>{taskCounts.today}</span>}
                    {taskCounts.thisWeek > 0 && <span className="min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.soon}>{taskCounts.thisWeek}</span>}
                  </div>
                )}
              </button>

              <button onClick={switchToToday} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${quickFilter === "today" ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <Sun size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{t("Today")}</span>
                {taskCounts.today > 0 && <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE["today"]}>{taskCounts.today}</span>}
              </button>

              <button onClick={switchToThisWeek} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${quickFilter === "thisWeek" ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <CalendarDays size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{t("This Week")}</span>
                {taskCounts.thisWeekTotal > 0 && <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE[taskCounts.thisWeekUrgency]}>{taskCounts.thisWeekTotal}</span>}
              </button>

              {taskCounts.overdue > 0 && (
                <button onClick={switchToOverdue} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${quickFilter === "overdue" ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                  <AlertCircle size={14} className={`flex-shrink-0 ${quickFilter !== "overdue" ? "text-red-400" : ""}`} />
                  <span className="flex-1 text-left truncate">{t("Overdue")}</span>
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE["overdue"]}>{taskCounts.overdue}</span>
                </button>
              )}
            </div>

            {/* Lists pill */}
            <div className="glass-card px-2 py-2 space-y-0.5">
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-[11px] text-black/40 dark:text-gray-600 uppercase tracking-wider font-medium">{t("Lists")}</span>
                <div className="flex items-center gap-1">
                  {!showNewFolder && (
                    <button onClick={() => setShowNewFolder(true)} className="text-gray-400 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default" aria-label={t("New folder")} title={t("New folder")}>
                      <FolderPlus size={13} />
                    </button>
                  )}
                  {!showNewList && (
                    <button onClick={() => setShowNewList(true)} className="text-gray-400 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default" aria-label={t("New list")} title={t("New list")}>
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>

              {showNewFolder && (
                <form onSubmit={handleAddFolder} className="flex items-center gap-1 px-2.5 pb-1">
                  <Folder size={11} className="text-gray-400 flex-shrink-0" />
                  <input autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setShowNewFolder(false); }} placeholder={t("Folder name...")} className="flex-1 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0" />
                  <button type="submit" className="text-gray-400 hover:text-black dark:hover:text-white transition-default"><Check size={12} /></button>
                  <button type="button" onClick={() => setShowNewFolder(false)} className="text-gray-400 hover:text-black dark:hover:text-white transition-default"><X size={12} /></button>
                </form>
              )}

              {showNewList && (
                <form onSubmit={handleAddList} className="flex items-center gap-1 px-2.5 pb-1">
                  <input autoFocus type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setShowNewList(false); }} placeholder={t("List name...")} className="flex-1 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0" />
                  <button type="submit" className="text-gray-400 hover:text-black dark:hover:text-white transition-default"><Check size={12} /></button>
                  <button type="button" onClick={() => setShowNewList(false)} className="text-gray-400 hover:text-black dark:hover:text-white transition-default"><X size={12} /></button>
                </form>
              )}

              <DndContext sensors={listSensors} collisionDetection={closestCenter} onDragEnd={handleListDragEnd}>
                <SortableContext items={lists.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  {/* Ungrouped lists drop zone */}
                  <UngroupedDropZone>
                    <div className="space-y-0.5">
                      {lists.filter((l) => !l.folder_id).map((list) => (
                        <SortableListItem
                          key={list.id} list={list}
                          isActive={activeListId === list.id}
                          onSelect={() => switchToList(list.id)}
                          badges={taskCounts.listBadges[list.id] ?? { overdue: 0, today: 0, thisWeek: 0 }}
                        />
                      ))}
                    </div>
                  </UngroupedDropZone>

                  {/* Folder groups */}
                  {folders.map((folder) => (
                    <FolderGroup
                      key={folder.id}
                      folder={folder}
                      folderLists={lists.filter((l) => l.folder_id === folder.id)}
                      isActive={activeFolderId === folder.id}
                      isCollapsed={!expandedFolders.has(folder.id)}
                      onToggleCollapse={() => setExpandedFolders((prev) => {
                        const next = new Set(prev);
                        next.has(folder.id) ? next.delete(folder.id) : next.add(folder.id);
                        return next;
                      })}
                      onSelect={() => switchToFolder(folder.id)}
                      isEditing={editingFolderId === folder.id}
                      editFolderName={editFolderName}
                      setEditFolderName={setEditFolderName}
                      onStartEdit={() => { setEditingFolderId(folder.id); setEditFolderName(folder.name); }}
                      onSaveEdit={() => handleUpdateFolder(folder.id)}
                      onCancelEdit={() => setEditingFolderId(null)}
                      onDelete={() => {
                        deleteFolder(folder.id, () => unassignFolder(folder.id));
                        if (activeFolderId === folder.id) switchToAllTasks();
                      }}
                      badges={taskCounts.folderBadges[folder.id] ?? { overdue: 0, today: 0, thisWeek: 0 }}
                      activeListId={activeListId}
                      onSelectList={(id) => switchToList(id)}
                      listBadges={taskCounts.listBadges}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Tags pill */}
            <div className="glass-card px-2 py-2">
              <TagManager tags={tags} onAdd={addTag} onDelete={deleteTag} />
            </div>

            {/* Events & Habits pill */}
            <div className="glass-card px-2 py-2 space-y-0.5">
              <button onClick={switchToEvents} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${eventsView ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <CalendarRange size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{t("Projects")}</span>
              </button>

              <button onClick={switchToHabits} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${habitsView ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <Repeat size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{t("Habits")}</span>
              </button>

              <button onClick={() => setShowTemplates(true)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default text-black dark:text-white glass-nav-hover border border-transparent">
                <LayoutTemplate size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{t("Templates")}</span>
                <span className="text-[11px] text-gray-400 font-mono">T</span>
              </button>
            </div>

            {/* Rules pill — header + list */}
            <div className="glass-card px-2 py-2 space-y-1">
              <div className="flex items-center gap-2 px-2.5 py-1 text-sm text-black dark:text-white">
                <Shield size={14} className="flex-shrink-0 opacity-50" />
                <button
                  onClick={switchToRules}
                  className="flex-1 text-left truncate opacity-50 hover:opacity-100 transition-default"
                >{t("Principles")}</button>
                <button
                  onClick={() => setShowRuleInput((v) => !v)}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                  aria-label={t("New principle")}
                  title={t("New principle (R)")}
                >
                  <Plus size={13} />
                </button>
              </div>
              {showRuleInput && (
                <div className="px-1 pb-1 border-b border-white/[0.06] mb-1">
                  <RuleInput onAdd={(title, desc, cat) => { addRule(title, desc, cat); setShowRuleInput(false); }} lists={lists} compact />
                </div>
              )}
              {rules.length > 0 && (
                <div className="space-y-0.5 max-h-[250px] overflow-y-auto">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="group flex items-start gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-default"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-black dark:text-white leading-snug line-clamp-2">{rule.title}</span>
                        {rule.description && (
                          <p className="text-[11px] text-black/30 dark:text-gray-600 leading-tight mt-0.5 line-clamp-1">{rule.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-default flex-shrink-0 mt-0.5"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {rules.length === 0 && !showRuleInput && (
                <p className="text-[11px] text-gray-600 text-center py-2">{t("No principles yet")}</p>
              )}
            </div>

            {/* Time stats — collapsed by default */}
            <button
              onClick={() => setShowTimeStats(prev => !prev)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-default text-black/40 dark:text-gray-600 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Clock size={13} className="flex-shrink-0" />
              <span className="flex-1 text-left truncate text-xs">{t("Time Tracking")}</span>
              <ChevronRight size={11} className={`transition-transform ${showTimeStats ? "rotate-90" : ""}`} />
            </button>
            {showTimeStats && (
              <div className="glass-card px-2 py-2">
                <TimeStats todos={todos} lists={lists} />
              </div>
            )}

          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pt-4 overflow-y-auto overflow-x-hidden pb-6" style={{ maxHeight: "calc(100vh - 24px)" }}>
          {/* Stats + calendar toggle + notification bell + mobile menu */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="md:hidden p-1.5 -ml-1.5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                aria-label={t("Open menu")}
              >
                <Menu size={20} />
              </button>

              <div className="display-inset inline-flex items-center gap-3 px-4 py-2 rounded-2xl">
                <h2 className="text-2xl md:text-3xl font-bold text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7)" }}>
                  {eventsView
                    ? t("Projects")
                    : rulesView
                      ? t("Principles")
                    : habitsView
                      ? t("Habits")
                      : calendarDates.length > 0
                        ? calendarDates.length === 1
                          ? new Date(calendarDates[0] + "T00:00:00").toLocaleDateString(formatLocale(), { weekday: "short", day: "numeric", month: "short" })
                          : t("{n} days selected", { n: calendarDates.length })
                        : quickFilter === "today"
                          ? t("Today")
                          : quickFilter === "thisWeek"
                            ? t("This Week")
                            : quickFilter === "overdue"
                              ? t("Overdue")
                              : activeList
                                ? activeList.name
                                : activeFolder
                                  ? activeFolder.name
                                  : t("All Tasks")}
                </h2>
                {activeList && !editingListId && (
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button
                        onClick={() => setShowListColorPicker((v) => !v)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white transition-default"
                        aria-label={t("Change color")}
                      >
                        {activeList.color ? (
                          <span className="w-3.5 h-3.5 rounded-full block" style={{ backgroundColor: activeList.color }} />
                        ) : (
                          <Palette size={16} />
                        )}
                      </button>
                      {showListColorPicker && (
                        <ColorPickerPopover color={activeList.color} onChange={(c) => { updateListColor(activeList.id, c); }} onClose={() => setShowListColorPicker(false)} />
                      )}
                    </div>
                    <button
                      onClick={() => { setEditingListId(activeList.id); setEditListName(activeList.name); }}
                      className="p-1.5 rounded-lg text-white/50 hover:text-white transition-default"
                      aria-label={t("Edit list")}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => { deleteList(activeList.id); switchToAllTasks(); }}
                      className="p-1.5 rounded-lg text-white/50 hover:text-red-400 transition-default"
                      aria-label={t("Delete list")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
                {activeList && editingListId === activeList.id && (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editListName}
                      onChange={(e) => setEditListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { handleUpdateList(activeList.id); }
                        if (e.key === "Escape") setEditingListId(null);
                      }}
                      className="text-sm bg-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                    />
                    <button onClick={() => handleUpdateList(activeList.id)} className="p-1.5 text-white/50 hover:text-white transition-default"><Check size={16} /></button>
                    <button onClick={() => setEditingListId(null)} className="p-1.5 text-white/50 hover:text-white transition-default"><X size={16} /></button>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-black/50 dark:text-gray-400">
                  {eventsView ? (
                    <span>{t(events.length === 1 ? "{n} project" : "{n} projects", { n: events.length })}</span>
                  ) : habitsView ? (
                    <span>
                      {todaysHabits.filter((h) => h.completedToday).length}/
                      {todaysHabits.length} today
                    </span>
                  ) : (
                    <>
                      <span>{t("{n} active", { n: activeTodoCount })}</span>
                      {completedTodoCount > 0 && (
                        <span>{t("{n} done", { n: completedTodoCount })}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Toolbar — every shortcut also has a button */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowCalendar((prev) => !prev)}
                className={`hidden md:flex p-2 rounded-xl transition-default ${
                  showCalendar
                    ? "glass-card-subtle text-black dark:text-white"
                    : "text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                aria-label={t("Toggle calendar panel")}
                aria-pressed={showCalendar}
                title={t("Calendar (C)")}
              >
                <CalendarDays size={16} />
              </button>
              <button
                onClick={() => setShowScheduleWeek((prev) => !prev)}
                className={`hidden md:flex p-2 rounded-xl transition-default ${
                  showScheduleWeek
                    ? "glass-card-subtle text-black dark:text-white"
                    : "text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                aria-label={t("Toggle week planner")}
                aria-pressed={showScheduleWeek}
                title={t("Week planner (S)")}
              >
                <CalendarRange size={16} />
              </button>
              <button
                onClick={() => setShowTemplates(true)}
                className="p-2 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                aria-label={t("Open templates")}
                title={t("Templates (T)")}
              >
                <LayoutTemplate size={16} />
              </button>
              <button
                onClick={() => setShowShortcuts(true)}
                className="hidden md:flex p-2 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                aria-label={t("Show keyboard shortcuts")}
                title={t("Keyboard shortcuts (?)")}
              >
                <Keyboard size={16} />
              </button>
            </div>

          </div>


          {/* Progress bar — always visible beneath the title when tasks exist */}
          {!habitsView && !eventsView && totalTodoCount > 0 && (
            <div className="mb-5">
              <div className="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full">
                <div
                  className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-black/50 dark:text-gray-400">{t("{done}/{total} completed", { done: completedTodoCount, total: totalTodoCount })}</span>
                <span className="text-[11px] text-black/50 dark:text-gray-400">{Math.round(progressPct)}%</span>
              </div>
            </div>
          )}


          {/* Input */}
          {(eventsView || habitsView || rulesView || showBar) && (
            <div className="mb-4">
              {eventsView ? (
                <EventInput onAdd={addEvent} lists={lists} />
              ) : habitsView ? (
                <HabitInput onAdd={addHabit} lists={lists} />
              ) : rulesView ? (
                <div className="glass-card p-4">
                  <RuleInput onAdd={(title, desc, cat) => addRule(title, desc, cat)} lists={lists} />
                </div>
              ) : (
                <TodoInput
                  onAdd={handleAddTodo}
                  onAddSubtask={addSubtask}
                  onCreateTag={addTag}
                  tags={tags}
                  lists={lists}
                  events={eventsWithTodos}
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
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >{t("All")}</button>
            <button
              onClick={switchToOverdue}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "overdue"
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >{t("Overdue")}</button>
            <button
              onClick={switchToToday}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "today"
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >{t("Today")}</button>
            <button
              onClick={switchToThisWeek}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "thisWeek"
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >{t("This Week")}</button>
            <button
              onClick={switchToEvents}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                eventsView
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >{t("Projects")}</button>
            <button
              onClick={switchToHabits}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                habitsView
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >{t("Habits")}</button>
            <button
              onClick={() => setFocusMode(true)}
              className="flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default text-black dark:text-white border border-black/15 dark:border-white/15"
            >{t("Focus")}</button>
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => switchToList(list.id)}
                className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                  activeListId === list.id
                    ? "bg-black dark:bg-white text-white"
                    : "text-black dark:text-white border border-black/15 dark:border-white/15"
                }`}
              >
                {list.name}
              </button>
            ))}
          </div>

          {/* Content */}
          {eventsView ? (
            <EventList
              events={eventsWithTodos}
              lists={lists}
              allTags={tags}
              loading={eventsLoading}
              onUpdate={handleUpdateEvent}
              onDelete={handleDeleteEvent}
              onAddTask={handleAddTaskToEvent}
              onRemoveTask={handleRemoveTaskFromEvent}
              onToggleTodo={handleToggleTodo}
              onUpdateTodo={updateTodo}
              onDeleteTodo={handleDeleteTodo}
              onTagToggle={toggleTodoTag}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              onAssignEvent={handleAssignTodoToEvent}
              onReorderEvents={reorderEvents}
              defaultSelectedEventId={openEventDetailId}
              onDefaultEventHandled={() => navigate({ kind: "events", eventId: null })}
            />
          ) : rulesView ? (
            <RuleList
              rules={rules}
              loading={rulesLoading}
              onUpdate={updateRule}
              onDelete={deleteRule}
              onReorder={reorderRules}
            />
          ) : habitsView ? (
            <HabitList
              habits={habits}
              todayHabitIds={todaysHabits.map((h) => h.id)}
              completions={habitCompletions}
              lists={lists}
              onToggle={toggleCompletion}
              onUpdate={updateHabit}
              onDelete={deleteHabit}
              onSkip={skipHabitForDate}
              onReorder={reorderHabits}
              loading={habitsLoading}
              highlightedHabitId={highlightedHabitId}
            />
          ) : (
            <TodoList
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
              loading={todosLoading}
              loadError={todosLoadError}
              onRetry={refetchTodos}
              onBulkComplete={bulkComplete}
              onBulkDelete={bulkDelete}
              onBulkUpdate={bulkUpdate}
              filterDate={null}
              lists={lists}
              activeListId={activeListId}
              events={eventsWithTodos}
              onAssignEvent={handleAssignTodoToEvent}
              onDeleteEvent={handleDeleteEvent}
              onOpenEventDetail={handleOpenEventDetail}
              defaultSortBy={
                activeListId ? "default"
                : quickFilter === "today" ? "timeline"
                : quickFilter === "thisWeek" ? "timeline"
                : "timeline"  /* allTasks default */
              }
              viewKey={viewKeyForList}
              showBar={showBar}
              onToggleBar={() => setShowBar((prev) => {
                const next = !prev;
                try { localStorage.setItem("showTaskBar", String(next)); } catch {}
                return next;
              })}
              suppressGroupKey={
                quickFilter === "today" ? "today"
                : quickFilter === "overdue" ? "overdue"
                : undefined
              }
              habits={visibleHabits}
              showHabits={visibleHabits.length > 0}
              onToggleHabit={toggleCompletion}
              highlightedTodoId={highlightedTodoId}
              wideMode={!showCalendar}
              onStartLiveTask={handleStartLiveTask}
              liveTaskId={liveTaskId}
            />
          )}
        </main>

        {/* Calendar + Timeline panel — desktop only, toggle with C key */}
        {showCalendar && !habitsView && !eventsView && (
          <aside className="hidden md:block md:w-96 md:flex-shrink-0 pt-6 space-y-2 overflow-y-auto overflow-x-hidden pb-6" style={{ maxHeight: "calc(100vh - 24px)" }}>
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
          </aside>
        )}
      </div>

      <Header email={email} />

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

      {/* Templates modal */}
      <TemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        templates={templates}
        lists={lists}
        onAdd={addTemplate}
        onUpdate={updateTemplate}
        onDelete={deleteTemplate}
        onApply={handleApply}
      />

      {/* Mobile sidebar drawer */}
      <MobileSidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        lists={lists}
        activeListId={activeListId}
        habitsView={habitsView}
        eventsView={eventsView}
        rulesView={rulesView}
        onSwitchToRules={switchToRules}
        quickFilter={quickFilter}
        onSwitchToAll={switchToAllTasks}
        onSwitchToEvents={switchToEvents}
        onSwitchToHabits={switchToHabits}
        onSwitchToList={switchToList}
        onSwitchToToday={switchToToday}
        onSwitchToThisWeek={switchToThisWeek}
        onAddList={() => setShowNewList(true)}
        onCreateList={(name) => addList(name)}
        onDeleteList={(id) => { deleteList(id); if (activeListId === id) switchToAllTasks(); }}
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
        title={t("Delete project")}
        message={`Are you sure you want to delete "${deleteEventTitle}" and all its tasks? This cannot be undone.`}
        onConfirm={confirmDeleteEvent}
        onCancel={() => setDeleteEventId(null)}
      />

      {/* Live task stopwatch bar */}
      {liveTask && (
        <LiveTaskBar
          todo={liveTask}
          lists={lists}
          onSaveTime={handleSaveLiveTime}
          onClose={() => setLiveTaskId(null)}
        />
      )}


      {/* Floating Focus button (mobile only, when not in focus mode) */}
      {isMobile && !focusMode && (
        <button
          onClick={() => setFocusMode(true)}
          className="md:hidden fixed bottom-4 right-16 z-50 flex items-center justify-center w-11 h-11 rounded-full glass-card-subtle text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all"
          aria-label={t("Enter focus mode")}
          title={t("Focus Mode")}
        >
          <Target size={18} />
        </button>
      )}
    </div>
    </>
  );
}
