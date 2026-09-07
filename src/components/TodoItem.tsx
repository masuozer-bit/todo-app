"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  CalendarClock,
  FileText,
  List as ListIcon,
  Plus,
  AlertCircle,
  Play,
  Clock,
  RotateCcw,
  ChevronRight,
  Pencil,
  LayoutTemplate,
} from "lucide-react";
import type { Todo, Tag, Priority, List, Event } from "@/lib/types";
import { CustomSelect, DatePicker, TimePicker } from "./Pickers";
import { getToday, getTomorrow, getNextMonday, getNextWeek } from "@/lib/date-helpers";
import TagPill from "./TagPill";
import { useToast } from "./Toast";
import { PRIORITY_META } from "@/lib/priority";

interface TodoItemProps {
  todo: Todo;
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (
    id: string,
    updates: {
      title?: string;
      due_date?: string | null;
      start_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      priority?: Priority;
      notes?: string | null;
      list_id?: string | null;
      estimated_time?: number | null;
      time_spent?: number | null;
      extra_dates?: { date: string; time?: string | null; completed: boolean }[] | null;
    }
  ) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  /** Create a tag from inside the detail panel */
  onCreateTag?: (name: string) => Promise<Tag | undefined>;
  /** Save this task as a reusable template */
  onSaveAsTemplate?: (todo: Todo) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  lists?: List[];
  activeListId?: string | null;
  events?: Event[];
  onAssignEvent?: (todoId: string, eventId: string | null) => void;
  onStartLiveTask?: (todoId: string) => void;
  isLiveTask?: boolean;
  highlighted?: boolean;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  high:   { label: PRIORITY_META.high.label,   color: PRIORITY_META.high.text,   dot: PRIORITY_META.high.dot },
  medium: { label: PRIORITY_META.medium.label, color: PRIORITY_META.medium.text, dot: PRIORITY_META.medium.dot },
  low:    { label: PRIORITY_META.low.label,    color: PRIORITY_META.low.text,    dot: PRIORITY_META.low.dot },
  none:   { label: PRIORITY_META.none.label,   color: PRIORITY_META.none.text,   dot: PRIORITY_META.none.dot },
};

function renderWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 dark:text-blue-400 underline hover:opacity-80 transition-default"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function formatDueDate(dateStr: string): { text: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0)
    return { text: `${Math.abs(diffDays)}d overdue`, overdue: true };
  if (diffDays === 0) return { text: "Today", overdue: false };
  if (diffDays === 1) return { text: "Tomorrow", overdue: false };
  return {
    text: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    overdue: false,
  };
}

export default function TodoItem({
  todo,
  allTags,
  onToggle,
  onUpdate,
  onDelete,
  onTagToggle,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onCreateTag,
  onSaveAsTemplate,
  dragHandleProps,
  isDragging = false,
  lists = [],
  activeListId,
  events = [],
  onAssignEvent,
  onStartLiveTask,
  isLiveTask = false,
  highlighted = false,
}: TodoItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.title);
  const [expanded,      setExpanded]      = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [slideIn,       setSlideIn]       = useState(false);
  const [domReady,      setDomReady]      = useState(false);

  useEffect(() => { setDomReady(true); }, []);

  useEffect(() => {
    if (expanded) {
      setPortalMounted(true);
      requestAnimationFrame(() => setSlideIn(true));
    } else {
      setSlideIn(false);
      const t = setTimeout(() => setPortalMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [expanded]);
  const [showNotes, setShowNotes] = useState(false);

  // Scroll into view and flash when highlighted
  useEffect(() => {
    if (highlighted && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);
  const [notesValue, setNotesValue] = useState(todo.notes ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [askSubtasks, setAskSubtasks] = useState(false);
  const [newExtraDate, setNewExtraDate] = useState({ date: "", time: "" });
  const [showExtraDates, setShowExtraDates] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  // Buffered so the estimate is written once, not on every keystroke
  const [estimateValue, setEstimateValue] = useState(
    todo.estimated_time ? String(todo.estimated_time) : ""
  );
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const titleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (titleClickTimer.current) clearTimeout(titleClickTimer.current); }, []);
  const todoTagIds = (todo.tags ?? []).map((t) => t.id);
  const subtasks = todo.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const allSubtasksDone = subtasks.length === 0 || completedSubtasks === subtasks.length;
  const priorityConf = PRIORITY_CONFIG[todo.priority ?? "none"];
  const dueInfo = todo.due_date ? formatDueDate(todo.due_date) : null;
  // Show list name only when viewing "All Tasks" (no active list filter)
  const todoList = todo.list_id ? lists.find((l) => l.id === todo.list_id) : null;
  const listName = !activeListId && todoList ? todoList.name : null;
  const listColor = todoList?.color ?? null;

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (showSubtaskInput) {
      subtaskRef.current?.focus();
    }
  }, [showSubtaskInput]);

  useEffect(() => {
    if (showTagInput) tagInputRef.current?.focus();
  }, [showTagInput]);

  useEffect(() => {
    setEstimateValue(todo.estimated_time ? String(todo.estimated_time) : "");
  }, [todo.estimated_time]);

  // Escape closes the detail panel
  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setExpanded(false);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [expanded]);

  function handleToggle() {
    // Open subtasks: ask instead of refusing
    if (!todo.completed && !allSubtasksDone) {
      setAskSubtasks(true);
      return;
    }
    onToggle(todo.id, !todo.completed);
  }

  function completeWithSubtasks() {
    for (const subtask of subtasks) {
      if (!subtask.completed) onToggleSubtask(todo.id, subtask.id, true);
    }
    onToggle(todo.id, true);
    setAskSubtasks(false);
  }

  function completeTaskOnly() {
    onToggle(todo.id, true);
    setAskSubtasks(false);
  }

  /* One click completes, two clicks rename — the short delay keeps both */
  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (titleClickTimer.current) return;
    titleClickTimer.current = setTimeout(() => {
      titleClickTimer.current = null;
      handleToggle();
    }, 220);
  }

  function handleTitleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (titleClickTimer.current) {
      clearTimeout(titleClickTimer.current);
      titleClickTimer.current = null;
    }
    if (todo.completed) return;
    setEditValue(todo.title);
    setEditing(true);
  }

  function cyclePriority(e: React.MouseEvent) {
    e.stopPropagation();
    const order: Priority[] = ["none", "low", "medium", "high"];
    const next = order[(order.indexOf(todo.priority ?? "none") + 1) % order.length];
    onUpdate(todo.id, { priority: next });
  }

  function handleSave() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== todo.title) {
      onUpdate(todo.id, { title: trimmed });
    } else {
      setEditValue(todo.title);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(todo.title);
      setEditing(false);
    }
  }

  function handleNotesSave() {
    onUpdate(todo.id, { notes: notesValue || null });
    setShowNotes(false);
  }

  function saveEstimate() {
    const parsedValue = parseInt(estimateValue, 10);
    const next = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
    if (next === (todo.estimated_time ?? null)) return;
    onUpdate(todo.id, { estimated_time: next });
  }

  async function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed || !onCreateTag) return;
    const tag = await onCreateTag(trimmed);
    if (tag) onTagToggle(todo.id, tag.id, true);
    setNewTagName("");
    setShowTagInput(false);
  }

  function handleAddSubtask() {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    onAddSubtask(todo.id, trimmed);
    setNewSubtask("");
    // Keep input open to add more
    subtaskRef.current?.focus();
  }

  function handleSubtaskKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAddSubtask();
    if (e.key === "Escape") {
      setNewSubtask("");
      setShowSubtaskInput(false);
    }
  }

  return (
    <>
    <div
      ref={itemRef}
      data-todo-id={todo.id}
      className={`group transition-default glass-card overflow-hidden relative ${listColor ? "list-colored" : ""}`}
      style={listColor ? { "--list-color": listColor } as React.CSSProperties : undefined}
    >
      {/* The pill — this IS the card */}
      {editing ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            ref={editRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { e.stopPropagation(); handleKeyDown(e); }}
            className="flex-1 bg-transparent text-black dark:text-white focus:outline-none text-sm"
            aria-label="Edit task title"
          />
          <button
            onClick={handleSave}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
            aria-label="Save edit"
          >
            <Check size={16} />
          </button>
          <button
            onMouseDown={() => { cancelledRef.current = true; }}
            onClick={() => {
              setEditValue(todo.title);
              setEditing(false);
              cancelledRef.current = false;
            }}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
            aria-label="Cancel edit"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          className={`relative px-3 py-2 cursor-pointer transition-default ${
            isDragging ? "opacity-50 scale-[1.02] shadow-lg" : ""
          } ${todo.completed ? "opacity-60" : ""} ${highlighted ? "ring-2 ring-blue-500/60 ring-offset-1" : ""}`}
          onClick={handleToggle}
          {...dragHandleProps}
          aria-label={`Mark "${todo.title}" as ${todo.completed ? "incomplete" : "complete"}`}
        >
          <p
            onClick={handleTitleClick}
            onDoubleClick={handleTitleDoubleClick}
            title="Double-click to rename"
            className={`text-sm transition-default pr-14 ${
              todo.completed
                ? "line-through text-gray-400"
                : "text-black dark:text-white"
            }`}
          >
            {renderWithLinks(todo.title)}
          </p>

          {/* Open subtasks — ask what to do instead of blocking */}
          {askSubtasks && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertCircle size={11} />
                {subtasks.length - completedSubtasks} subtask
                {subtasks.length - completedSubtasks !== 1 ? "s" : ""} still open
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); completeWithSubtasks(); }}
                className="px-2 py-1 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium"
              >
                Complete all
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); completeTaskOnly(); }}
                className="px-2 py-1 rounded-lg glass-card-subtle text-black dark:text-white font-medium"
              >
                Task only
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setAskSubtasks(false); }}
                className="px-2 py-1 rounded-lg text-gray-500 hover:text-black dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Meta: priority, due date, subtasks toggle, notes, list */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {todo.priority && todo.priority !== "none" && (
              <button
                onClick={cyclePriority}
                title="Click to change priority"
                aria-label={`Priority ${priorityConf.label}, click to change`}
                className={`flex items-center gap-1 text-xs font-medium rounded px-1 -mx-1 hover:bg-black/5 dark:hover:bg-white/10 transition-default ${priorityConf.color}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${priorityConf.dot}`}
                />
                {priorityConf.label}
              </button>
            )}
            {todo.start_date && !todo.completed && (
              <span className="flex items-center gap-1 text-xs text-black/50 dark:text-gray-400">
                <CalendarClock size={11} />
                Start {formatDueDate(todo.start_date).text}
              </span>
            )}
            {dueInfo && (todo.extra_dates ?? []).length === 0 && (
              <DatePicker
                value={todo.due_date ?? ""}
                onChange={(v) => onUpdate(todo.id, { due_date: v || null })}
                ariaLabel={`Due ${dueInfo.text}, click to change`}
                triggerClassName={`flex items-center gap-1 text-xs rounded px-1 -mx-1 hover:bg-black/5 dark:hover:bg-white/10 transition-default ${
                  dueInfo.overdue
                    ? "text-red-500 dark:text-red-400 font-medium"
                    : "text-black/50 dark:text-gray-400"
                }`}
                trigger={
                  <>
                    <Calendar size={11} />
                    {dueInfo.text}
                    {todo.start_time && (
                      <span className="text-black/40 dark:text-gray-400 ml-0.5">
                        {todo.start_time}{todo.end_time ? `–${todo.end_time}` : ""}
                      </span>
                    )}
                  </>
                }
              />
            )}
            {/* Multi-date view: show all dates when extra_dates exist */}
            {(todo.extra_dates ?? []).length > 0 && (
              <span className="flex items-center gap-1.5 flex-wrap">
                {todo.due_date && (() => {
                  const info = formatDueDate(todo.due_date);
                  return (
                    <span className={`flex items-center gap-1 text-xs ${info.overdue ? "text-red-500 dark:text-red-400 font-medium" : "text-black/50 dark:text-gray-400"}`}>
                      <Calendar size={11} />
                      {info.text}
                    </span>
                  );
                })()}
                {[...(todo.extra_dates ?? [])].sort((a, b) => a.date.localeCompare(b.date)).map((ed, i) => {
                  const info = formatDueDate(ed.date);
                  return (
                    <span
                      key={i}
                      className={`flex items-center gap-1 text-xs ${
                        ed.completed
                          ? "line-through text-black/25 dark:text-gray-600"
                          : info.overdue
                          ? "text-red-500 dark:text-red-400 font-medium"
                          : "text-black/50 dark:text-gray-400"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ed.completed ? "bg-emerald-500" : info.overdue ? "bg-red-500" : "bg-black/20 dark:bg-white/20"}`} />
                      {info.text}
                      {ed.time && <span className="text-black/30 dark:text-gray-600">{ed.time}</span>}
                    </span>
                  );
                })}
              </span>
            )}
            {/* Subtasks standalone toggle */}
            {subtasks.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSubtasksExpanded((v) => !v); }}
                className={`flex items-center gap-1.5 text-xs font-medium transition-default rounded px-1 -mx-1 ${
                  allSubtasksDone
                    ? "text-green-500 dark:text-green-400"
                    : "text-gray-400 hover:text-black dark:hover:text-white"
                }`}
                aria-label={subtasksExpanded ? "Collapse subtasks" : "Expand subtasks"}
              >
                <span className="w-10 h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                  <span
                    className={`block h-full rounded-full transition-all duration-300 ${
                      allSubtasksDone ? "bg-green-500 dark:bg-green-400" : "bg-black/40 dark:bg-white/40"
                    }`}
                    style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                  />
                </span>
                <span className="tabular-nums">{completedSubtasks}/{subtasks.length}</span>
                {subtasksExpanded
                  ? <ChevronUp size={11} />
                  : <ChevronDown size={11} />}
              </button>
            )}
            {todo.notes && (
              <span className="text-xs text-black/50 dark:text-gray-400 flex items-center gap-1 min-w-0 max-w-[220px]">
                <FileText size={11} className="flex-shrink-0" />
                <span className="truncate">{todo.notes.split("\n")[0]}</span>
              </span>
            )}
            {listName && (
              <span className="text-xs text-black/45 dark:text-gray-500 flex items-center gap-1">
                <ListIcon size={11} />
                {listName}
              </span>
            )}
            {(todo.time_spent ?? 0) > 0 && (
              <span className={`text-xs flex items-center gap-0.5 ${isLiveTask ? "text-emerald-400" : "text-black/40 dark:text-gray-500"}`}>
                <Clock size={11} />
                {(() => {
                  const s = todo.time_spent!;
                  const h = Math.floor(s / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                })()}
                {todo.estimated_time && (
                  <span className="text-black/25 dark:text-gray-600">/ {todo.estimated_time < 60 ? `${todo.estimated_time}m` : `${Math.round(todo.estimated_time / 60 * 10) / 10}h`}</span>
                )}
              </span>
            )}
            {!todo.time_spent && todo.estimated_time && (
              <span className="text-xs flex items-center gap-0.5 text-black/30 dark:text-gray-600">
                <Clock size={11} />
                ~{todo.estimated_time < 60 ? `${todo.estimated_time}m` : `${Math.round(todo.estimated_time / 60 * 10) / 10}h`}
              </span>
            )}
          </div>

          {/* Actions — top right corner, also reachable by keyboard and touch */}
          <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-default">
            {!todo.completed && onStartLiveTask && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartLiveTask(todo.id); }}
                className={`p-1.5 [@media(hover:none)]:p-2.5 rounded-lg transition-default ${
                  isLiveTask
                    ? "text-emerald-400 bg-emerald-500/20"
                    : "text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                }`}
                aria-label="Start timer"
              >
                <Play size={14} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-1.5 [@media(hover:none)]:p-2.5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
              className="p-1.5 [@media(hover:none)]:p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-default"
              aria-label={`Delete "${todo.title}"`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Tags */}
      {(todo.tags ?? []).length > 0 && !editing && (
        <div className="flex flex-wrap gap-1.5 mt-1.5 px-1">
          {(todo.tags ?? []).map((tag) => (
            <TagPill
              key={tag.id}
              name={tag.name}
              size="sm"
              onRemove={
                !todo.completed
                  ? () => {
                      onTagToggle(todo.id, tag.id, false);
                      showToast({
                        message: `Tag "${tag.name}" removed`,
                        onUndo: () => onTagToggle(todo.id, tag.id, true),
                      });
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Inline subtasks */}
      {subtasks.length > 0 && subtasksExpanded && !editing && (
        <div className="mt-1.5 pl-3 pr-1 border-l-2 border-black/10 dark:border-white/10 ml-3">
          <div className="space-y-1.5">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 group/subtask"
              >
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={() =>
                    onToggleSubtask(todo.id, subtask.id, !subtask.completed)
                  }
                  aria-label={`Complete subtask ${subtask.title}`}
                  className="custom-checkbox flex-shrink-0 my-1.5"
                  style={{ width: "1rem", height: "1rem" }}
                />
                <span
                  className={`flex-1 text-sm transition-default ${
                    subtask.completed
                      ? "line-through text-gray-400"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {subtask.title}
                </span>
                {!todo.completed && (
                  <button
                    onClick={() => onDeleteSubtask(todo.id, subtask.id)}
                    className="p-1.5 opacity-0 group-hover/subtask:opacity-100 group-focus-within/subtask:opacity-100 [@media(hover:none)]:opacity-100 text-gray-400 hover:text-red-500 transition-default flex-shrink-0"
                    aria-label="Delete subtask"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!todo.completed && !showSubtaskInput && (
            <button
              onClick={() => {
                setExpanded(true);
                setShowSubtaskInput(true);
              }}
              className="flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
            >
              <Plus size={11} />
              Add subtask
            </button>
          )}
        </div>
      )}

      {/* Animated list colour strip — always at bottom of card */}
      {listColor && <div className="list-strip" aria-hidden="true" />}
    </div>

    {/* ── Task detail side panel (portal) ── */}
    {domReady && portalMounted && createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[200] bg-black/60 transition-opacity duration-300"
          style={{ opacity: slideIn ? 1 : 0 }}
          onClick={() => setExpanded(false)}
        />

        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Task details: ${todo.title}`}
          className="fixed right-0 top-0 bottom-0 left-0 md:left-auto z-[201] flex flex-col overflow-hidden md:w-[clamp(320px,35vw,440px)]"
          style={{
            background: "linear-gradient(160deg, rgba(30,30,40,0.97) 0%, rgba(18,18,26,0.99) 100%)",
            backdropFilter: "blur(48px) saturate(160%)",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            transform: slideIn ? "translateX(0)" : "translateX(100%)",
            transition: "transform 300ms cubic-bezier(0.32,0.72,0,1)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-white/8 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium mb-1">Task</p>
              {editing ? (
                <input
                  ref={editRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={(e) => { e.stopPropagation(); handleKeyDown(e); }}
                  className="w-full bg-transparent text-white text-base font-semibold focus:outline-none border-b border-white/25 pb-0.5"
                  aria-label="Edit task title"
                />
              ) : (
                <button
                  className="group/title flex items-start gap-1.5 text-left w-full"
                  onClick={() => { if (!todo.completed) setEditing(true); }}
                  aria-label="Rename task"
                >
                  <span className="text-base font-semibold text-white border-b border-dashed border-white/25 group-hover/title:border-white/60 transition-default">
                    {todo.title}
                  </span>
                  {!todo.completed && (
                    <Pencil size={12} className="mt-1.5 flex-shrink-0 text-white/30 group-hover/title:text-white/70 transition-default" />
                  )}
                </button>
              )}
            </div>
            <button
              onClick={() => setExpanded(false)}
              aria-label="Close task details"
              className="mt-0.5 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-default flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: "thin" }}>

            {/* Completed tasks can be reopened from here */}
            {todo.completed && (
              <button
                onClick={() => onToggle(todo.id, false)}
                className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-xl border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-default"
              >
                <RotateCcw size={12} />
                Reopen task
              </button>
            )}

            {/* Due date & time */}
            {!todo.completed && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium mb-2">Due date</p>
                <div className="flex gap-1 flex-wrap mb-2">
                  {[
                    { label: "Today",     val: getToday() },
                    { label: "Tomorrow",  val: getTomorrow() },
                    { label: "Next Mon",  val: getNextMonday() },
                    { label: "Next Week", val: getNextWeek() },
                  ].map((pick) => (
                    <button
                      key={pick.label}
                      onClick={() => onUpdate(todo.id, { due_date: pick.val })}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
                        todo.due_date === pick.val
                          ? "border-white/25 bg-white/10 text-white font-medium"
                          : "border-white/8 text-white/40 hover:border-white/20 hover:text-white/70"
                      }`}
                    >
                      {pick.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DatePicker
                    value={todo.due_date ?? ""}
                    onChange={(v) => onUpdate(todo.id, { due_date: v || null, ...(v ? {} : { start_time: null, end_time: null }) })}
                  />
                  {todo.due_date && (
                    <>
                      <TimePicker
                        value={todo.start_time ?? ""}
                        onChange={(v) => onUpdate(todo.id, { start_time: v || null })}
                      />
                      {todo.start_time && (
                        <>
                          <span className="text-xs text-white/30">→</span>
                          <TimePicker
                            value={todo.end_time ?? ""}
                            onChange={(v) => onUpdate(todo.id, { end_time: v || null })}
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] uppercase tracking-wide text-white/35 font-medium">Start</span>
                  <DatePicker
                    value={todo.start_date ?? ""}
                    onChange={(v) => onUpdate(todo.id, { start_date: v || null })}
                    placeholder="Start date"
                  />
                </div>
              </div>
            )}

            {/* Priority */}
            {!todo.completed && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium mb-2">Priority</p>
                <div className="flex gap-1.5">
                  {(["high", "medium", "low", "none"] as Priority[]).map((p) => {
                    const conf = PRIORITY_CONFIG[p];
                    return (
                      <button
                        key={p}
                        onClick={() => onUpdate(todo.id, { priority: p })}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border transition-default ${
                          todo.priority === p
                            ? "border-white/25 bg-white/10 font-medium text-white"
                            : "border-white/8 text-white/40 hover:border-white/20 hover:text-white/70"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf.dot}`} />
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List — always visible so it is clear a task can have one */}
            {!todo.completed && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium mb-2">List</p>
                {lists.length > 0 ? (
                  <CustomSelect
                    value={todo.list_id ?? ""}
                    onChange={(v) => onUpdate(todo.id, { list_id: v || null })}
                    options={[{ value: "", label: "No list" }, ...lists.map((l) => ({ value: l.id, label: l.name, color: l.color ?? undefined }))]}
                    className="w-full"
                  />
                ) : (
                  <p className="text-xs text-white/25 italic">No lists yet. Create one in the sidebar</p>
                )}
              </div>
            )}

            {/* Tags — always visible, with a way to create one */}
            {!todo.completed && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const hasTag = todoTagIds.includes(tag.id);
                    return <TagPill key={tag.id} name={tag.name} size="sm" selected={hasTag} onClick={() => onTagToggle(todo.id, tag.id, !hasTag)} />;
                  })}
                  {allTags.length === 0 && !showTagInput && (
                    <span className="text-xs text-white/25 italic">No tags yet</span>
                  )}
                </div>
                {onCreateTag && (
                  showTagInput ? (
                    <div className="flex items-center gap-1.5 mt-2">
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") handleCreateTag();
                          if (e.key === "Escape") { setNewTagName(""); setShowTagInput(false); }
                        }}
                        placeholder="Tag name..."
                        maxLength={30}
                        className="flex-1 text-sm bg-transparent border-b border-white/15 pb-0.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/35"
                      />
                      <button onClick={handleCreateTag} className="text-white/40 hover:text-white transition-default"><Check size={14} /></button>
                      <button onClick={() => { setNewTagName(""); setShowTagInput(false); }} className="text-white/40 hover:text-white transition-default"><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setShowTagInput(true)} className="mt-2 text-[11px] text-white/35 hover:text-white transition-default">+ New tag</button>
                  )
                )}
              </div>
            )}

            {/* Event assignment */}
            {!todo.completed && onAssignEvent && events.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium mb-2">Project</p>
                <CustomSelect
                  value={todo.event_id ?? ""}
                  onChange={(v) => onAssignEvent(todo.id, v || null)}
                  options={[{ value: "", label: "No project" }, ...events.map((ev) => ({ value: ev.id, label: ev.title }))]}
                  className="w-full"
                />
              </div>
            )}

            {/* Estimated time — buffered so typing does not write per keystroke */}
            {!todo.completed && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium mb-2">Est. time</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={999}
                    placeholder="min"
                    value={estimateValue}
                    onChange={(e) => setEstimateValue(e.target.value)}
                    onBlur={saveEstimate}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") { e.currentTarget.blur(); }
                    }}
                    className="w-24 text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-default tabular-nums"
                  />
                  {todo.estimated_time && (
                    <>
                      <span className="text-xs text-white/30 tabular-nums flex-shrink-0">
                        {todo.estimated_time < 60 ? `${todo.estimated_time}m` : `${Math.floor(todo.estimated_time / 60)}h${todo.estimated_time % 60 > 0 ? `${todo.estimated_time % 60}m` : ""}`}
                      </span>
                      <button onClick={() => { setEstimateValue(""); onUpdate(todo.id, { estimated_time: null }); }} className="text-white/30 hover:text-white transition-default flex-shrink-0">
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
                {todo.estimated_time && (todo.time_spent ?? 0) > 0 && (() => {
                  const estSec = todo.estimated_time * 60;
                  const ratio  = todo.time_spent! / estSec;
                  const pct    = Math.round(ratio * 100);
                  const isGood = ratio >= 0.8 && ratio <= 1.2;
                  const isOver = ratio > 1.2;
                  return (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full ${isGood ? "bg-emerald-500" : isOver ? "bg-red-400" : "bg-blue-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className={`text-[11px] font-medium tabular-nums ${isGood ? "text-emerald-400" : isOver ? "text-red-400" : "text-blue-400"}`}>{pct}%</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Notes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium">Notes</p>
                {!showNotes && !todo.completed && (
                  <button onClick={() => setShowNotes(true)} className="text-[11px] text-white/35 hover:text-white transition-default">
                    {todo.notes ? "Edit" : "+ Add"}
                  </button>
                )}
              </div>
              {showNotes ? (
                <div>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Add a note..."
                    rows={4}
                    className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none transition-default"
                    autoFocus
                  />
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={handleNotesSave} className="text-xs px-3 py-1.5 rounded-lg bg-white text-black hover:opacity-85 transition-default font-medium">Save</button>
                    <button onClick={() => { setNotesValue(todo.notes ?? ""); setShowNotes(false); }} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white transition-default">Cancel</button>
                  </div>
                </div>
              ) : todo.notes ? (
                <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">{renderWithLinks(todo.notes)}</p>
              ) : (
                <p className="text-xs text-white/20 italic">No notes</p>
              )}
            </div>

            {/* Subtasks — the existing ones are listed here, not just added */}
            {!todo.completed && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-white/35 font-medium">
                    Subtasks{subtasks.length > 0 && <span className="ml-1 font-normal normal-case text-white/25">({completedSubtasks}/{subtasks.length})</span>}
                  </p>
                  {!showSubtaskInput && (
                    <button onClick={() => setShowSubtaskInput(true)} className="text-[11px] text-white/35 hover:text-white transition-default">+ Add</button>
                  )}
                </div>
                {subtasks.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center gap-2 group/psub">
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={() => onToggleSubtask(todo.id, subtask.id, !subtask.completed)}
                          className="custom-checkbox flex-shrink-0"
                          style={{ width: "1rem", height: "1rem" }}
                          aria-label={`Complete subtask ${subtask.title}`}
                        />
                        <span className={`flex-1 text-sm ${subtask.completed ? "line-through text-white/30" : "text-white/80"}`}>
                          {subtask.title}
                        </span>
                        <button
                          onClick={() => onDeleteSubtask(todo.id, subtask.id)}
                          className="p-1 opacity-0 group-hover/psub:opacity-100 group-focus-within/psub:opacity-100 [@media(hover:none)]:opacity-100 text-white/30 hover:text-red-400 transition-default"
                          aria-label={`Delete subtask ${subtask.title}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {showSubtaskInput && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      ref={subtaskRef}
                      type="text"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={handleSubtaskKeyDown}
                      placeholder="Subtask title..."
                      className="flex-1 text-sm bg-transparent border-b border-white/15 pb-0.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/35"
                    />
                    <button onClick={handleAddSubtask} className="text-white/40 hover:text-white transition-default"><Check size={14} /></button>
                    <button onClick={() => { setNewSubtask(""); setShowSubtaskInput(false); }} className="text-white/40 hover:text-white transition-default"><X size={14} /></button>
                  </div>
                )}
                {subtasks.length === 0 && !showSubtaskInput && (
                  <p className="text-xs text-white/20 italic">No subtasks</p>
                )}
              </div>
            )}

            {/* Additional dates — folded away, it is a rare case */}
            {!todo.completed && (
              <div>
                <button
                  onClick={() => setShowExtraDates((v) => !v)}
                  className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/35 hover:text-white/70 font-medium transition-default"
                  aria-expanded={showExtraDates}
                >
                  <ChevronRight size={11} className={`transition-transform ${showExtraDates ? "rotate-90" : ""}`} />
                  More dates{(todo.extra_dates ?? []).length > 0 ? ` (${(todo.extra_dates ?? []).length})` : ""}
                </button>
                {showExtraDates && (
                  <div className="mt-2">
                    <div className="space-y-1.5 mb-2">
                      {todo.due_date && (
                        <div className="flex items-center gap-2 text-xs text-white/25">
                          <span className="w-2.5 h-2.5 rounded-full border border-white/15 flex-shrink-0" />
                          <span className="tabular-nums">{todo.due_date}</span>
                          {todo.start_time && <span className="tabular-nums">{todo.start_time}{todo.end_time ? `–${todo.end_time}` : ""}</span>}
                          <span className="text-[11px] text-white/20">primary</span>
                        </div>
                      )}
                      {[...(todo.extra_dates ?? [])].sort((a, b) => a.date.localeCompare(b.date)).map((ed, i) => (
                        <div key={i} className="flex items-center gap-2 group/ed">
                          <button
                            onClick={() => {
                              const sorted  = [...(todo.extra_dates ?? [])].sort((a, b) => a.date.localeCompare(b.date));
                              const realIdx = (todo.extra_dates ?? []).indexOf(sorted[i]);
                              const updated = (todo.extra_dates ?? []).map((d, j) => j === realIdx ? { ...d, completed: !d.completed } : d);
                              onUpdate(todo.id, { extra_dates: updated });
                            }}
                            className={`w-2.5 h-2.5 rounded-full border flex-shrink-0 transition-default ${ed.completed ? "bg-emerald-500 border-emerald-500" : "border-white/25 hover:border-white/50"}`}
                            aria-label={ed.completed ? "Mark date as open" : "Mark date as done"}
                          />
                          <span className={`text-xs tabular-nums flex-1 ${ed.completed ? "line-through text-white/25" : "text-white"}`}>{ed.date}</span>
                          <TimePicker
                            value={ed.time ?? ""}
                            onChange={(v) => {
                              const sorted  = [...(todo.extra_dates ?? [])].sort((a, b) => a.date.localeCompare(b.date));
                              const realIdx = (todo.extra_dates ?? []).indexOf(sorted[i]);
                              const updated = (todo.extra_dates ?? []).map((d, j) => j === realIdx ? { ...d, time: v || null } : d);
                              onUpdate(todo.id, { extra_dates: updated });
                            }}
                          />
                          <button
                            onClick={() => {
                              const sorted  = [...(todo.extra_dates ?? [])].sort((a, b) => a.date.localeCompare(b.date));
                              const realIdx = (todo.extra_dates ?? []).indexOf(sorted[i]);
                              const updated = (todo.extra_dates ?? []).filter((_, j) => j !== realIdx);
                              onUpdate(todo.id, { extra_dates: updated });
                            }}
                            className="opacity-0 group-hover/ed:opacity-100 [@media(hover:none)]:opacity-100 text-white/30 hover:text-red-400 transition-default"
                            aria-label="Remove date"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <DatePicker
                        value={newExtraDate.date}
                        onChange={(v) => setNewExtraDate((p) => ({ ...p, date: v }))}
                        placeholder="Add date"
                      />
                      <TimePicker
                        value={newExtraDate.time}
                        onChange={(v) => setNewExtraDate((p) => ({ ...p, time: v }))}
                      />
                      <button
                        onClick={() => {
                          if (!newExtraDate.date) return;
                          onUpdate(todo.id, {
                            extra_dates: [...(todo.extra_dates ?? []), { date: newExtraDate.date, time: newExtraDate.time || null, completed: false }],
                          });
                          setNewExtraDate({ date: "", time: "" });
                        }}
                        disabled={!newExtraDate.date}
                        className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-default disabled:opacity-30"
                        aria-label="Add date"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timer and template */}
            {!todo.completed && (onStartLiveTask || onSaveAsTemplate) && (
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-4">
                {onStartLiveTask && (
                  <button
                    onClick={() => { onStartLiveTask(todo.id); setExpanded(false); }}
                    className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-default"
                  >
                    <Play size={12} />
                    {isLiveTask ? "Timer running" : "Start timer"}
                  </button>
                )}
                {onSaveAsTemplate && (
                  <button
                    onClick={() => onSaveAsTemplate(todo)}
                    className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-default"
                  >
                    <LayoutTemplate size={12} />
                    Save as template
                  </button>
                )}
              </div>
            )}

            {/* Danger zone */}
            <div className="pt-2 border-t border-white/5">
              <button
                onClick={() => { onDelete(todo.id); setExpanded(false); }}
                className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-default"
              >
                <Trash2 size={12} />
                Delete task
              </button>
            </div>

          </div>
        </div>
      </>,
      document.body
    )}
    </>
  );
}
