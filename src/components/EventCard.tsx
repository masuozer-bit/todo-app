"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  Check,
  X,
  Unlink,
} from "lucide-react";
import type { Event, Todo, List } from "@/lib/types";

interface EventCardProps {
  event: Event;
  lists: List[];
  onUpdate: (id: string, updates: { title?: string; description?: string | null; list_id?: string | null; color?: string }) => void;
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
  onRemoveTask: (eventId: string, todoId: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
}

const EVENT_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
];

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default function EventCard({
  event,
  lists,
  onUpdate,
  onDelete,
  onAddTask,
  onRemoveTask,
  onToggleTodo,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const editRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<HTMLInputElement>(null);
  const todos = event.todos ?? [];
  const completedCount = todos.filter((t) => t.completed).length;
  const listName = event.list_id
    ? lists.find((l) => l.id === event.list_id)?.name
    : null;

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (showAddTask) taskRef.current?.focus();
  }, [showAddTask]);

  function handleSaveTitle() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== event.title) {
      onUpdate(event.id, { title: trimmed });
    } else {
      setEditTitle(event.title);
    }
    setEditing(false);
  }

  function handleAddTask() {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    onAddTask(event.id, trimmed, {
      due_date: newTaskDate || null,
    });
    setNewTaskTitle("");
    setNewTaskDate("");
    taskRef.current?.focus();
  }

  return (
    <div className="glass-card-subtle overflow-hidden">
      {/* Color accent bar */}
      <div
        className="h-1"
        style={{ backgroundColor: event.color ?? "#6366f1" }}
      />

      {/* Header */}
      <div className="p-3 md:p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default flex-shrink-0"
          >
            {expanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  ref={editRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setEditTitle(event.title);
                      setEditing(false);
                    }
                  }}
                  className="flex-1 bg-transparent text-black dark:text-white focus:outline-none text-base font-medium border-b border-black/20 dark:border-white/20 pb-0.5"
                />
              </div>
            ) : (
              <p
                className="text-base font-medium text-black dark:text-white cursor-pointer"
                onClick={() => setEditing(true)}
              >
                {event.title}
              </p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">
                {todos.length} task{todos.length !== 1 ? "s" : ""}
                {completedCount > 0 && ` · ${completedCount} done`}
              </span>
              {listName && (
                <span className="text-xs text-gray-300 dark:text-gray-600">
                  · {listName}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => {
                setExpanded(true);
                setShowAddTask(true);
              }}
              className="text-gray-400 hover:text-black dark:hover:text-white transition-default p-1"
              aria-label="Add task to event"
              title="Add task"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-default p-1"
              aria-label="Delete event"
              title="Delete event"
            >
              <Trash2 size={14} />
            </button>
          </div>
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

      {/* Expanded: task list */}
      {expanded && (
        <div className="border-t border-black/5 dark:border-white/5 px-4 pb-4 pt-3 space-y-2">
          {/* Color picker */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Color
            </span>
            <div className="flex gap-1.5">
              {EVENT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onUpdate(event.id, { color })}
                  className={`w-5 h-5 rounded-full transition-default ${
                    event.color === color
                      ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-black"
                      : "hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: color,
                    // @ts-expect-error Tailwind ring-color via CSS custom property
                    "--tw-ring-color": event.color === color ? color : undefined,
                  }}
                  aria-label={`Set color to ${color}`}
                />
              ))}
            </div>
          </div>

          {/* List assignment */}
          {lists.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                List
              </span>
              <select
                value={event.list_id ?? ""}
                onChange={(e) =>
                  onUpdate(event.id, { list_id: e.target.value || null })
                }
                className="text-xs bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="">No list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tasks */}
          {todos.length > 0 ? (
            <div className="space-y-1.5">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2.5 group/task py-1.5 px-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-default"
                >
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => onToggleTodo(todo.id, !todo.completed)}
                    className="custom-checkbox flex-shrink-0"
                  />
                  <span
                    className={`flex-1 text-sm transition-default ${
                      todo.completed
                        ? "line-through text-gray-400"
                        : "text-black dark:text-white"
                    }`}
                  >
                    {todo.title}
                  </span>
                  {todo.due_date && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                      <Calendar size={10} />
                      {formatEventDate(todo.due_date)}
                    </span>
                  )}
                  <button
                    onClick={() => onRemoveTask(event.id, todo.id)}
                    className="opacity-0 group-hover/task:opacity-100 text-gray-400 hover:text-red-500 transition-default flex-shrink-0"
                    aria-label="Remove from event"
                    title="Remove from event"
                  >
                    <Unlink size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-300 dark:text-gray-600 italic py-2">
              No tasks yet — add one below
            </p>
          )}

          {/* Add task inline */}
          {showAddTask ? (
            <div className="flex items-center gap-2 pt-2">
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
                placeholder="Task title..."
                className="flex-1 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none"
              />
              <input
                type="date"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-black dark:text-white focus:outline-none"
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
          ) : (
            <button
              onClick={() => setShowAddTask(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default pt-1"
            >
              <Plus size={13} />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
