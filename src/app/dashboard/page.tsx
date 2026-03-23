"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import TodoInput from "@/components/TodoInput";
import TodoList from "@/components/TodoList";
import CalendarPanel from "@/components/CalendarPanel";
import TimelinePanel from "@/components/TimelinePanel";
import ScheduleWeekModal from "@/components/ScheduleWeekModal";
import HabitInput from "@/components/HabitInput";
import HabitList from "@/components/HabitList";
import ToastContainer, { type ToastData } from "@/components/Toast";
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
import { useTodos } from "@/hooks/useTodos";
import { useTags } from "@/hooks/useTags";
import { useLists } from "@/hooks/useLists";
import { useFolders } from "@/hooks/useFolders";
import { useHabits } from "@/hooks/useHabits";
import { useEvents } from "@/hooks/useEvents";
import { useRules } from "@/hooks/useRules";
import { useTemplates } from "@/hooks/useTemplates";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
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
import { Plus, Inbox, Trash2, Edit2, Check, X, Repeat, Menu, Sun, CalendarDays, CalendarRange, Target, AlertCircle, FolderPlus, Folder, Shield, Palette, Clock, ChevronRight } from "lucide-react";
import { getToday } from "@/lib/date-helpers";
import { fetchCalendarEvents } from "@/lib/calendar-sync-client";
import type { User } from "@supabase/supabase-js";
import type { List as ListType, Folder as FolderType } from "@/lib/types";

type Urgency = "overdue" | "today" | "soon" | "normal";
const URGENCY_STYLE: Record<Urgency, React.CSSProperties> = {
  overdue: { backgroundColor: "rgba(239,68,68,0.18)", color: "#f87171", backdropFilter: "blur(8px)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  today:   { backgroundColor: "rgba(245,158,11,0.18)", color: "#fbbf24", backdropFilter: "blur(8px)", animation: "urgency-pulse 2.5s ease-in-out infinite" },
  soon:    { backgroundColor: "rgba(59,130,246,0.16)", color: "#60a5fa", backdropFilter: "blur(8px)" },
  normal:  { backgroundColor: "rgba(120,120,120,0.12)", color: "rgba(180,180,180,0.9)" },
};


function ColorPickerPopover({ color, onChange, onClose }: { color?: string | null; onChange: (c: string | null) => void; onClose: () => void }) {
  return (
    <div className="absolute z-50 top-full left-0 mt-1 p-2 rounded-xl glass-card-raised flex items-center gap-2 w-auto" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <input
        type="color"
        value={color || "#60a5fa"}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white/30"
        title="Pick a color"
      />
      <button
        onClick={() => { onChange(null); onClose(); }}
        className="w-8 h-8 rounded-lg border-2 border-white/20 flex items-center justify-center transition-default hover:border-white/50"
        style={{ background: "rgba(120,120,120,0.3)" }}
        title="Remove color"
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
                <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.overdue}>
                  {badges.overdue}
                </span>
              )}
              {badges.today > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.today}>
                  {badges.today}
                </span>
              )}
              {badges.thisWeek > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.soon}>
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
              <button onClick={onStartEdit} className={`p-1 rounded transition-default ${isActive ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`} aria-label="Rename folder"><Edit2 size={10} /></button>
              <button onClick={onDelete} className={`p-1 rounded transition-default ${isActive ? "text-white/70 hover:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`} aria-label="Delete folder"><Trash2 size={10} /></button>
            </div>
            {(badges.overdue > 0 || badges.today > 0 || badges.thisWeek > 0) && (
              <div className="flex items-center gap-0.5 flex-shrink-0 mr-3">
                {badges.overdue > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.overdue}>{badges.overdue}</span>
                )}
                {badges.today > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.today}>{badges.today}</span>
                )}
                {badges.thisWeek > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.soon}>{badges.thisWeek}</span>
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
            <p className="text-[10px] text-gray-300 dark:text-gray-600 px-1 py-1">Drop lists here</p>
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

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
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
  const [calendarDates, setCalendarDates] = useState<string[]>([]);
  const [habitsView, setHabitsView] = useState(false);
  const [showHabitsInTasks, setShowHabitsInTasks] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("showHabitsInTasks") === "true"; } catch { return false; }
  });
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [highlightedTodoId, setHighlightedTodoId] = useState<string | null>(null);
  const [highlightedHabitId, setHighlightedHabitId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<"overdue" | "today" | "thisWeek" | null>("today");
  const [eventsView, setEventsView] = useState(false);
  const [rulesView, setRulesView] = useState(false);
  const [showRuleInput, setShowRuleInput] = useState(false);
  const [liveTaskId, setLiveTaskId] = useState<string | null>(null);
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
  const router = useRouter();
  const supabase = createClient();
  const { toggleTheme, theme, tint, lavaLamp, lavaColor } = useTheme();

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

  const { tags } = useTags(user?.id);
  const { lists, addList, updateList, updateListColor, deleteList, reorderLists, moveListToFolder, unassignFolder } = useLists(user?.id);
  const { folders, addFolder, updateFolder, deleteFolder } = useFolders(user?.id);
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

  const { rules, loading: rulesLoading, addRule, updateRule, deleteRule, reorderRules } = useRules(user?.id);
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates(user?.id);

  // Push notifications
  usePushNotifications(todos);


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
      setShowBar(true);
      try { localStorage.setItem("showTaskBar", "true"); } catch {}
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="New task title"]'
        );
        input?.focus();
      }, 0);
    },
    onSearch: () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Search tasks"]'
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
    onEscape: () => {
      setShowBar(false);
      try { localStorage.setItem("showTaskBar", "false"); } catch {}
    },
  });

  // Keep a ref to refetchTodos so the calendar sync effect always has the latest version
  const refetchTodosRef = useRef(refetchTodos);
  useEffect(() => { refetchTodosRef.current = refetchTodos; }, [refetchTodos]);

  // Initial Google Calendar sync — import Google Calendar events as todos on load
  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    end.setDate(end.getDate() + 7);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    fetchCalendarEvents(fmt(start), fmt(end)).then(() => {
      // Refetch todos to pick up any newly imported Google Calendar events
      setTimeout(() => refetchTodosRef.current(), 500);
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSaveLiveTime = useCallback((todoId: string, totalSeconds: number) => {
    updateTodo(todoId, { time_spent: totalSeconds });
  }, [updateTodo]);

  // Template apply handlers
  const handleApplyTaskTemplate = useCallback(async (data: import("@/lib/types").TaskTemplateData) => {
    const id = await addTodo(data.title, [], {
      priority: data.priority,
      notes: data.notes,
      list_id: data.list_id,
      start_time: data.start_time,
      end_time: data.end_time,
    });
    if (id && data.estimated_time) {
      await updateTodo(id, { estimated_time: data.estimated_time });
    }
    if (id && (data.subtasks ?? []).length > 0) {
      for (const title of data.subtasks!) {
        await addSubtask(id, title);
      }
    }
  }, [addTodo, updateTodo, addSubtask]);

  const handleApplyEventTemplate = useCallback(async (
    data: import("@/lib/types").EventTemplateData,
    date: string
  ) => {
    const event = await addEvent(data.title, {
      description: data.description ?? undefined,
      color: data.color ?? undefined,
      list_id: data.list_id,
      due_date: date,
      start_time: data.start_time ?? undefined,
      end_time: data.end_time ?? undefined,
    });
    if (!event) return;
    for (const task of data.tasks) {
      const todoId = await addTodo(task.title, [], {
        priority: task.priority,
        notes: task.notes,
        list_id: task.list_id ?? data.list_id,
        start_time: task.start_time,
        end_time: task.end_time,
        event_id: event.id,
        due_date: date,
      });
      if (todoId && task.estimated_time) {
        await updateTodo(todoId, { estimated_time: task.estimated_time });
      }
      if (todoId && (task.subtasks ?? []).length > 0) {
        for (const title of task.subtasks!) {
          await addSubtask(todoId, title);
        }
      }
    }
    refetchTodos();
  }, [addEvent, addTodo, updateTodo, addSubtask, refetchTodos]);

  function switchToRules() {
    setRulesView(true);
    setHabitsView(false);
    setEventsView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setCalendarDates([]);
    setQuickFilter(null);
  }

  function switchToHabits() {
    setHabitsView(true);
    setEventsView(false);
    setRulesView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setCalendarDates([]);
    setQuickFilter(null);
  }

  function switchToEvents() {
    setEventsView(true);
    setHabitsView(false);
    setRulesView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setCalendarDates([]);
    setQuickFilter(null);
  }

  function switchToAllTasks() {
    setHabitsView(false);
    setEventsView(false);
    setRulesView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setQuickFilter(null);
  }

  function switchToList(listId: string) {
    setHabitsView(false);
    setEventsView(false);
    setRulesView(false);
    setActiveListId(listId);
    setActiveFolderId(null);
    setQuickFilter(null);
  }

  function switchToFolder(folderId: string) {
    setActiveFolderId(folderId);
    setActiveListId(null);
    setHabitsView(false);
    setEventsView(false);
    setRulesView(false);
    setQuickFilter(null);
    setCalendarDates([]);
  }

  function handleCalendarDatesChange(dates: string[]) {
    setCalendarDates(dates);
    if (dates.length > 0) setQuickFilter(null);
  }

  function switchToToday() {
    setHabitsView(false);
    setEventsView(false);
    setRulesView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setQuickFilter("today");
    setCalendarDates([]);
  }

  function switchToThisWeek() {
    setHabitsView(false);
    setEventsView(false);
    setRulesView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setQuickFilter("thisWeek");
    setCalendarDates([]);
  }

  function switchToOverdue() {
    setHabitsView(false);
    setEventsView(false);
    setRulesView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setQuickFilter("overdue");
    setCalendarDates([]);
  }

  function handleTimelineTodoClick(todoId: string) {
    // Switch to "all tasks" view so the todo is visible, then scroll to it
    setHabitsView(false);
    setEventsView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setCalendarDates([]);
    setQuickFilter(null);
    setHighlightedTodoId(todoId);
    // Scroll to the todo after the view updates
    setTimeout(() => {
      const el = document.querySelector(`[data-todo-id="${todoId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear highlight after a moment
      setTimeout(() => setHighlightedTodoId(null), 2000);
    }, 150);
  }

  function handleTimelineHabitClick(habitId: string) {
    // Switch to habits view and highlight the habit via React state
    setHabitsView(true);
    setEventsView(false);
    setActiveListId(null);
    setActiveFolderId(null);
    setCalendarDates([]);
    setQuickFilter(null);
    setHighlightedHabitId(habitId);
    setTimeout(() => setHighlightedHabitId(null), 2200);
  }

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  const activeTodoCount = visibleTodos.filter((t) => !t.completed).length;
  const completedTodoCount = visibleTodos.filter((t) => t.completed).length;
  const totalTodoCount = activeTodoCount + completedTodoCount;
  const progressPct = totalTodoCount > 0 ? (completedTodoCount / totalTodoCount) * 100 : 0;

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
    {/* Lava lamp animated background (dark mode only) */}
    {theme === "dark" && lavaLamp && <LavaLampBackground tint={lavaColor} />}

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
    <div className="h-screen overflow-hidden transition-colors relative" style={{ zIndex: 1 }}>
      <div className={`mx-auto px-4 pt-6 pb-0 flex gap-6 h-full ${!habitsView && !eventsView ? "max-w-[1380px]" : "max-w-5xl"}`}>
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex md:flex-col w-48 flex-shrink-0 pt-4 overflow-y-auto overflow-x-hidden pb-4" style={{ maxHeight: "calc(100vh - 24px)" }}>
          <div className="space-y-2">

            {/* Smart views pill */}
            <div className="glass-card px-2 py-2 space-y-0.5">
              <button onClick={switchToAllTasks} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${!activeListId && !habitsView && !eventsView && !quickFilter ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <Inbox size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">All Tasks</span>
                {(taskCounts.overdue > 0 || taskCounts.today > 0 || taskCounts.thisWeek > 0) && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {taskCounts.overdue > 0 && <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.overdue}>{taskCounts.overdue}</span>}
                    {taskCounts.today > 0 && <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.today}>{taskCounts.today}</span>}
                    {taskCounts.thisWeek > 0 && <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE.soon}>{taskCounts.thisWeek}</span>}
                  </div>
                )}
              </button>

              <button onClick={switchToToday} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${quickFilter === "today" ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <Sun size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">Today</span>
                {taskCounts.today > 0 && <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE["today"]}>{taskCounts.today}</span>}
              </button>

              <button onClick={switchToThisWeek} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${quickFilter === "thisWeek" ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <CalendarDays size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">This Week</span>
                {taskCounts.thisWeekTotal > 0 && <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE[taskCounts.thisWeekUrgency]}>{taskCounts.thisWeekTotal}</span>}
              </button>

              {taskCounts.overdue > 0 && (
                <button onClick={switchToOverdue} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${quickFilter === "overdue" ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                  <AlertCircle size={14} className={`flex-shrink-0 ${quickFilter !== "overdue" ? "text-red-400" : ""}`} />
                  <span className="flex-1 text-left truncate">Overdue</span>
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none" style={URGENCY_STYLE["overdue"]}>{taskCounts.overdue}</span>
                </button>
              )}
            </div>

            {/* Lists pill */}
            <div className="glass-card px-2 py-2 space-y-0.5">
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-[10px] text-black/40 dark:text-gray-600 uppercase tracking-wider font-medium">Lists</span>
                <div className="flex items-center gap-1">
                  {!showNewFolder && (
                    <button onClick={() => setShowNewFolder(true)} className="text-gray-400 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default" aria-label="New folder" title="New folder">
                      <FolderPlus size={13} />
                    </button>
                  )}
                  {!showNewList && (
                    <button onClick={() => setShowNewList(true)} className="text-gray-400 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default" aria-label="New list" title="New list">
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>

              {showNewFolder && (
                <form onSubmit={handleAddFolder} className="flex items-center gap-1 px-2.5 pb-1">
                  <Folder size={11} className="text-gray-400 flex-shrink-0" />
                  <input autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setShowNewFolder(false); }} placeholder="Folder name..." className="flex-1 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0" />
                  <button type="submit" className="text-gray-400 hover:text-black dark:hover:text-white transition-default"><Check size={12} /></button>
                  <button type="button" onClick={() => setShowNewFolder(false)} className="text-gray-400 hover:text-black dark:hover:text-white transition-default"><X size={12} /></button>
                </form>
              )}

              {showNewList && (
                <form onSubmit={handleAddList} className="flex items-center gap-1 px-2.5 pb-1">
                  <input autoFocus type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setShowNewList(false); }} placeholder="List name..." className="flex-1 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0" />
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
                        if (activeFolderId === folder.id) setActiveFolderId(null);
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

            {/* Events & Habits pill */}
            <div className="glass-card px-2 py-2 space-y-0.5">
              <button onClick={switchToEvents} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${eventsView ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <CalendarRange size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">Events</span>
              </button>

              <button onClick={switchToHabits} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-default ${habitsView ? "glass-nav-active font-medium" : "text-black dark:text-white glass-nav-hover border border-transparent"}`}>
                <Repeat size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">Habits</span>
              </button>
            </div>

            {/* Rules pill — header + list */}
            <div className="glass-card px-2 py-2 space-y-1">
              <div className="flex items-center gap-2 px-2.5 py-1 text-sm text-black dark:text-white">
                <Shield size={14} className="flex-shrink-0 opacity-50" />
                <span className="flex-1 text-left truncate opacity-50">Rules</span>
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
                          <p className="text-[9px] text-black/30 dark:text-gray-600 leading-tight mt-0.5 line-clamp-1">{rule.description}</p>
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
                <p className="text-[10px] text-gray-600 text-center py-2">Press R to add a rule</p>
              )}
            </div>

            {/* Time stats — collapsed by default */}
            <button
              onClick={() => setShowTimeStats(prev => !prev)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-default text-black/40 dark:text-gray-600 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Clock size={13} className="flex-shrink-0" />
              <span className="flex-1 text-left truncate text-xs">Time Tracking</span>
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
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>

              <div className="display-inset inline-flex items-center gap-3 px-4 py-2 rounded-2xl">
                <h2 className="text-2xl md:text-3xl font-bold text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7)" }}>
                  {eventsView
                    ? "Events"
                    : habitsView
                      ? "Habits"
                      : quickFilter === "today"
                        ? "Today"
                        : quickFilter === "thisWeek"
                          ? "This Week"
                          : quickFilter === "overdue"
                            ? "Overdue"
                            : activeList
                              ? activeList.name
                              : activeFolder
                                ? activeFolder.name
                                : "All Tasks"}
                </h2>
                {activeList && !editingListId && (
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button
                        onClick={() => setShowListColorPicker((v) => !v)}
                        className="p-1.5 rounded-lg text-white/50 hover:text-white transition-default"
                        aria-label="Change color"
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
                      aria-label="Edit list"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => { deleteList(activeList.id); setActiveListId(null); }}
                      className="p-1.5 rounded-lg text-white/50 hover:text-red-400 transition-default"
                      aria-label="Delete list"
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

            {/* Show-habits-in-tasks toggle — only when not in habitsView/eventsView */}
            {!habitsView && !eventsView && todaysHabits.length > 0 && (
              <button
                onClick={() => {
                  const next = !showHabitsInTasks;
                  setShowHabitsInTasks(next);
                  try { localStorage.setItem("showHabitsInTasks", String(next)); } catch {}
                }}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-default glass-card-subtle ${
                  showHabitsInTasks
                    ? "text-black dark:text-white"
                    : "text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white"
                }`}
                aria-label={showHabitsInTasks ? "Hide habits in task view" : "Show habits in task view"}
              >
                <Repeat size={13} />
                <span>Habits</span>
                {showHabitsInTasks && (
                  <span className="text-black/40 dark:text-gray-500 text-[10px]">
                    {todaysHabits.filter((h) => h.completedToday).length}/{todaysHabits.length}
                  </span>
                )}
              </button>
            )}
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
                <span className="text-[11px] text-black/50 dark:text-gray-400">{completedTodoCount}/{totalTodoCount} completed</span>
                <span className="text-[11px] text-black/50 dark:text-gray-400">{Math.round(progressPct)}%</span>
              </div>
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
                  onAddSubtask={addSubtask}
                  tags={tags}
                  lists={lists}
                  events={events}
                  activeListId={activeListId}
                  onRefetchEvents={refetchEvents}
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
            >
              All
            </button>
            <button
              onClick={switchToOverdue}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "overdue"
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >
              Overdue
            </button>
            <button
              onClick={switchToToday}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "today"
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >
              Today
            </button>
            <button
              onClick={switchToThisWeek}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                quickFilter === "thisWeek"
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >
              This Week
            </button>
            <button
              onClick={switchToEvents}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                eventsView
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >
              Events
            </button>
            <button
              onClick={switchToHabits}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default ${
                habitsView
                  ? "bg-black dark:bg-white text-white"
                  : "text-black dark:text-white border border-black/15 dark:border-white/15"
              }`}
            >
              Habits
            </button>
            <button
              onClick={() => setFocusMode(true)}
              className="flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-default text-black dark:text-white border border-black/15 dark:border-white/15"
            >
              Focus
            </button>
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
              completions={habitCompletions}
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
              filterDate={null}
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
                : quickFilter === "overdue" ? "overdue"
                : "allTasks"
              }
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
              habits={todaysHabits}
              showHabits={showHabitsInTasks}
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
              events={events}
              onTodoClick={handleTimelineTodoClick}
              onHabitClick={handleTimelineHabitClick}
              onUpdateTodo={updateTodo}
              weekModalOpen={showScheduleWeek}
              onToggleWeekModal={() => setShowScheduleWeek(prev => !prev)}
            />
          </aside>
        )}
      </div>

      <Header email={user?.email} />

      {/* Schedule week modal — independent of calendar panel */}
      {showScheduleWeek && (
        <ScheduleWeekModal
          todos={todos}
          habits={todaysHabits}
          lists={lists}
          events={events}
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
        onApplyTask={handleApplyTaskTemplate}
        onApplyEvent={handleApplyEventTemplate}
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

      {/* Live task stopwatch bar */}
      {liveTask && (
        <LiveTaskBar
          todo={liveTask}
          lists={lists}
          onSaveTime={handleSaveLiveTime}
          onClose={() => setLiveTaskId(null)}
        />
      )}

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
