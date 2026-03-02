"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Check, X } from "lucide-react";
import type { Event, Todo, Tag, List, Priority } from "@/lib/types";
import TodoItem from "./TodoItem";

interface EventCardProps {
  event: Event;
  lists: List[];
  allTags: Tag[];
  events: Event[];
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
  onUpdateTodo: (id: string, updates: { title?: string; due_date?: string | null; start_time?: string | null; end_time?: string | null; priority?: Priority; notes?: string | null; list_id?: string | null }) => void;
  onDeleteTodo: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  onAssignEvent: (todoId: string, eventId: string | null) => void;
  onRefetchEvents?: () => void;
}



export default function EventCard({
  event,
  lists,
  allTags,
  events,
  onUpdate,
  onDelete,
  onAddTask,
  onRemoveTask,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onTagToggle,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAssignEvent,
  onRefetchEvents,
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
            <input
              type="color"
              value={event.color ?? "#6366f1"}
              onChange={(e) => onUpdate(event.id, { color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer border border-black/20 dark:border-white/20"
              aria-label="Pick event color"
            />
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

          {/* Tasks — full TodoItem with all options */}
          {todos.length > 0 ? (
            <div className="-mx-4 border-t border-black/5 dark:border-white/5 divide-y divide-black/5 dark:divide-white/5">
              {todos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  allTags={allTags}
                  onToggle={(id, completed) => {
                    onToggleTodo(id, completed);
                    onRefetchEvents?.();
                  }}
                  onUpdate={onUpdateTodo}
                  onDelete={onDeleteTodo}
                  onTagToggle={onTagToggle}
                  onAddSubtask={onAddSubtask}
                  onToggleSubtask={onToggleSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  lists={lists}
                  events={events}
                  onAssignEvent={onAssignEvent}
                />
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
