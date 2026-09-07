"use client";

import { useState, useRef, useEffect } from "react";
import { formatLocale } from "@/lib/format";
import { useI18n } from "./I18nProvider";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  X,
  Calendar,
  Trash2,
} from "lucide-react";
import type { Event, Tag, List, Priority } from "@/lib/types";
import TaskRow from "./TaskRow";
import { CustomSelect, DatePicker, TimePicker } from "./Pickers";

function formatEventDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(formatLocale(), {
    month: "short",
    day: "numeric",
  });
}

interface EventDetailProps {
  event: Event;
  lists: List[];
  allTags: Tag[];
  events: Event[];
  onBack: () => void;
  onUpdate: (
    id: string,
    updates: {
      title?: string;
      description?: string | null;
      list_id?: string | null;
      color?: string;
      due_date?: string | null;
      end_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
    }
  ) => void;
  onDelete: (id: string) => void;
  onAddTask: (
    eventId: string,
    title: string,
    options?: {
      due_date?: string | null;
      start_time?: string | null;
      priority?: string;
      list_id?: string | null;
    }
  ) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onUpdateTodo: (
    id: string,
    updates: {
      title?: string;
      due_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      priority?: Priority;
      notes?: string | null;
      list_id?: string | null;
    }
  ) => void;
  onDeleteTodo: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (
    todoId: string,
    subtaskId: string,
    completed: boolean
  ) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  onAssignEvent: (todoId: string, eventId: string | null) => void;
}

export default function EventDetail({
  event,
  lists,
  allTags,
  events,
  onBack,
  onUpdate,
  onDelete,
  onAddTask,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onTagToggle,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAssignEvent,
}: EventDetailProps) {
  const { t } = useI18n();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(event.title);
  // Buffered so the description is written once, on blur
  const [descriptionValue, setDescriptionValue] = useState(event.description ?? "");
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<HTMLInputElement>(null);

  const todos = event.todos ?? [];
  const completedCount = todos.filter((t) => t.completed).length;
  const activeCount = todos.length - completedCount;
  const listName = event.list_id
    ? lists.find((l) => l.id === event.list_id)?.name
    : null;

  // Keep title in sync if the event updates externally
  useEffect(() => {
    setTitleValue(event.title);
  }, [event.title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (showAddTask) taskRef.current?.focus();
  }, [showAddTask]);

  useEffect(() => {
    setDescriptionValue(event.description ?? "");
  }, [event.description]);

  function saveDescription() {
    const next = descriptionValue.trim() || null;
    if (next === (event.description ?? null)) return;
    onUpdate(event.id, { description: next });
  }

  function handleSaveTitle() {
    const t = titleValue.trim();
    if (t && t !== event.title) onUpdate(event.id, { title: t });
    else setTitleValue(event.title);
    setEditingTitle(false);
  }

  function handleAddTask() {
    const t = newTaskTitle.trim();
    if (!t) return;
    onAddTask(event.id, t, { due_date: newTaskDate || null });
    setNewTaskTitle("");
    setNewTaskDate("");
    taskRef.current?.focus();
  }

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-black dark:hover:text-white transition-default mb-5"
      >
        <ChevronLeft size={15} />
        Events
      </button>

      {/* Event header card */}
      <div className="glass-card overflow-hidden mb-5">
        {/* Color accent bar */}
        <div
          className="h-1.5"
          style={{ backgroundColor: event.color ?? "#6366f1" }}
        />

        <div className="p-4 md:p-5">
          {/* Title */}
          {editingTitle ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                ref={titleRef}
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setTitleValue(event.title);
                    setEditingTitle(false);
                  }
                }}
                className="flex-1 bg-transparent text-xl font-semibold text-black dark:text-white focus:outline-none border-b border-black/20 dark:border-white/20 pb-0.5"
              />
            </div>
          ) : (
            <h2
              className="text-xl font-semibold text-black dark:text-white cursor-pointer hover:opacity-75 transition-default mb-1"
              onClick={() => setEditingTitle(true)}
              title={t("Click to rename")}
            >
              {event.title}
            </h2>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-400">
            <span>
              {activeCount} active
              {completedCount > 0 && ` · ${completedCount} done`}
            </span>
            {event.due_date && (
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {formatEventDate(event.due_date)}
                {event.end_date && event.end_date !== event.due_date
                  ? ` → ${formatEventDate(event.end_date)}`
                  : ""}
              </span>
            )}
            {listName && (
              <span className="text-gray-300 dark:text-gray-600">
                · {listName}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {todos.length > 0 && (
            <div className="mt-3 w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(completedCount / todos.length) * 100}%`,
                  backgroundColor: event.color ?? "#6366f1",
                }}
              />
            </div>
          )}
        </div>

        {/* Settings toggle */}
        <div className="border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between px-4 md:px-5">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="flex items-center gap-1.5 py-2.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
            >
              {showSettings ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              Settings
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="text-gray-400 hover:text-red-500 transition-default p-1"
              aria-label={t("Delete project")}
              title={t("Delete project")}
            >
              <Trash2 size={13} />
            </button>
          </div>

          {showSettings && (
            <div className="px-4 md:px-5 pb-4 space-y-3 border-t border-black/5 dark:border-white/5 pt-3">
              {/* Color */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-10 flex-shrink-0">{t("Color")}</span>
                <input
                  type="color"
                  value={event.color ?? "#6366f1"}
                  onChange={(e) =>
                    onUpdate(event.id, { color: e.target.value })
                  }
                  className="w-6 h-6 rounded cursor-pointer border border-black/20 dark:border-white/20"
                  aria-label={t("Project colour")}
                />
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-10 flex-shrink-0">{t("Date")}</span>
                <DatePicker
                  value={event.due_date ?? ""}
                  onChange={(v) => onUpdate(event.id, { due_date: v || null })}
                  placeholder={t("Start date")}
                />
                <span className="text-xs text-gray-400">→</span>
                <DatePicker
                  value={event.end_date ?? ""}
                  onChange={(v) => onUpdate(event.id, { end_date: v || null })}
                  placeholder={t("End date")}
                />
                {(event.due_date || event.end_date) && (
                  <button
                    onClick={() =>
                      onUpdate(event.id, { due_date: null, end_date: null })
                    }
                    className="text-gray-400 hover:text-red-500 transition-default"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Time */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-10 flex-shrink-0">{t("Time")}</span>
                <TimePicker
                  value={event.start_time ?? ""}
                  onChange={(v) => onUpdate(event.id, { start_time: v || null })}
                  placeholder={t("Start")}
                />
                {event.start_time && (
                  <>
                    <span className="text-xs text-gray-400">→</span>
                    <TimePicker
                      value={event.end_time ?? ""}
                      onChange={(v) => onUpdate(event.id, { end_time: v || null })}
                      placeholder={t("End")}
                    />
                  </>
                )}
                {(event.start_time || event.end_time) && (
                  <button
                    onClick={() =>
                      onUpdate(event.id, { start_time: null, end_time: null })
                    }
                    className="text-gray-400 hover:text-red-500 transition-default"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Description */}
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-10 flex-shrink-0 mt-1.5">{t("About")}</span>
                <textarea
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  onBlur={saveDescription}
                  placeholder={t("What is this project about?")}
                  rows={2}
                  className="flex-1 text-xs bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/25 dark:focus:border-white/25 resize-none transition-default"
                />
              </div>

              {/* List */}
              {lists.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-10 flex-shrink-0">{t("List")}</span>
                  <CustomSelect
                    value={event.list_id ?? ""}
                    onChange={(v) => onUpdate(event.id, { list_id: v || null })}
                    options={[
                      { value: "", label: "No list" },
                      ...lists.map((l) => ({ value: l.id, label: l.name, color: l.color ?? undefined })),
                    ]}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Tasks
          {todos.length > 0 && (
            <span className="ml-1 font-normal normal-case">
              ({activeCount} active)
            </span>
          )}
        </h3>
        {!showAddTask && (
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
          >
            <Plus size={13} />{t("Add task")}</button>
        )}
      </div>

      {/* Add task form */}
      {showAddTask && (
        <div className="glass-card-subtle p-3 mb-3 flex items-center gap-2">
          <input
            ref={taskRef}
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTask();
              if (e.key === "Escape") {
                setNewTaskTitle("");
                setNewTaskDate("");
                setShowAddTask(false);
              }
            }}
            placeholder={t("New task...")}
            className="flex-1 text-sm bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none"
          />
          <DatePicker
            value={newTaskDate}
            onChange={setNewTaskDate}
            placeholder={t("Date")}
          />
          <button
            onClick={handleAddTask}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => {
              setNewTaskTitle("");
              setNewTaskDate("");
              setShowAddTask(false);
            }}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Task list */}
      {todos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10 italic">
          No tasks yet — add one above
        </p>
      ) : (
        <div>
          {todos.map((todo) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              lists={lists}
              onSelect={() => {}}
              onToggle={onToggleTodo}
              onRename={(id, title) => onUpdateTodo(id, { title })}
              onDelete={onDeleteTodo}
              onSetPriority={(id, priority) => onUpdateTodo(id, { priority })}
              onSetList={(id, listId) => onUpdateTodo(id, { list_id: listId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
