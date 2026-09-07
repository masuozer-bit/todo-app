"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Check, X, Maximize2 } from "lucide-react";
import type { Event, Todo, Tag, List, Priority } from "@/lib/types";
import TodoItem from "./TodoItem";
import { CustomSelect, DatePicker } from "./Pickers";

interface EventCardProps {
  event: Event;
  lists: List[];
  allTags: Tag[];
  events: Event[];
  onUpdate: (id: string, updates: { title?: string; description?: string | null; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null }) => void;
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
  onOpenDetail?: (id: string) => void;
}



function formatEventDate(dateStr: string): string {
  // Parse YYYY-MM-DD without timezone shift
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getPeekUrgencyColor(todo: Todo, eventColor: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!todo.due_date) return eventColor;
  if (todo.due_date < today) return "#ef4444";
  if (todo.due_date === today) return "#f59e0b";
  return eventColor;
}

function formatPeekLabel(todo: Todo): string | null {
  if (todo.start_time) return todo.start_time.slice(0, 5);
  if (!todo.due_date) return null;
  const [y, m, d] = todo.due_date.split("-").map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(y, m - 1, d);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  onOpenDetail,
}: EventCardProps) {
  const [expanded,      setExpanded]      = useState(false);


  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [peekIdx, setPeekIdx] = useState(0);
  const editRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<HTMLInputElement>(null);
  const todos = event.todos ?? [];
  const completedCount = todos.filter((t) => t.completed).length;
  const incompleteTodos = todos.filter((t) => !t.completed);

  useEffect(() => {
    if (incompleteTodos.length === 0) return;
    const t = setInterval(() => setPeekIdx((i) => i + 1), 3000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incompleteTodos.length]);
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
    <>
    <div className="glass-card overflow-hidden group relative list-colored" style={{ "--list-color": event.color ?? "#6366f1" } as React.CSSProperties}>

      {/* Header */}
      <div className={todos.length === 0 ? "py-2 px-3" : "p-3 md:p-4"}>
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
                className={`${todos.length === 0 ? "text-sm" : "text-base"} font-medium text-black dark:text-white cursor-pointer`}
                onClick={() => setEditing(true)}
              >
                {event.title}
              </p>
            )}

            {event.description && (
              <p className="text-xs text-black/50 dark:text-gray-400 mt-1 line-clamp-2">{event.description}</p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">
                {todos.length} task{todos.length !== 1 ? "s" : ""}
                {completedCount > 0 && ` · ${completedCount} done`}
              </span>
              {event.due_date && (
                <span className="text-xs text-gray-400">
                  · {formatEventDate(event.due_date)}
                  {event.end_date && event.end_date !== event.due_date
                    ? ` → ${formatEventDate(event.end_date)}`
                    : ""}
                </span>
              )}
              {listName && (
                <span className="text-xs text-gray-300 dark:text-gray-600">
                  · {listName}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {onOpenDetail && (
              <button
                onClick={() => onOpenDetail(event.id)}
                className="text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 hover:text-black dark:hover:text-white transition-default p-1"
                aria-label="Open project"
                title="Open project view"
              >
                <Maximize2 size={13} />
              </button>
            )}
            <button
              onClick={() => {
                setExpanded(true);
                setShowAddTask(true);
              }}
              className="text-gray-400 hover:text-black dark:hover:text-white transition-default p-1"
              aria-label="Add task to project"
              title="Add task"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="text-gray-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-500 transition-default p-1"
              aria-label="Delete project"
              title="Delete project"
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

        {/* Peek ticker — cycles incomplete tasks when collapsed */}
        {!expanded && incompleteTodos.length > 0 && (() => {
          const peekTodo = incompleteTodos[peekIdx % incompleteTodos.length];
          const dotColor = getPeekUrgencyColor(peekTodo, event.color ?? "#6366f1");
          const label = formatPeekLabel(peekTodo);
          return (
            <div className="mt-2 overflow-hidden h-[14px]">
              <div key={peekIdx} className="peek-ticker flex items-center gap-1.5 min-w-0">
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-none">
                  {peekTodo.title}
                </span>
                {label && (
                  <span className="text-[10px] flex-shrink-0 leading-none font-medium" style={{ color: dotColor }}>
                    · {label}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Tasks — the chevron opens them right here, the full view stays */}
        {expanded && (
          <div className="mt-3 space-y-1.5">
            {todos.length > 0 ? (
              todos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  allTags={allTags}
                  onToggle={onToggleTodo}
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
              ))
            ) : (
              <p className="text-xs text-gray-400 italic">No tasks yet</p>
            )}

            {showAddTask ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  ref={taskRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleAddTask();
                    if (e.key === "Escape") { setNewTaskTitle(""); setNewTaskDate(""); setShowAddTask(false); }
                  }}
                  placeholder="Task title..."
                  className="flex-1 text-sm bg-transparent border-b border-black/15 dark:border-white/15 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none"
                />
                <DatePicker value={newTaskDate} onChange={setNewTaskDate} placeholder="Date" />
                <button onClick={handleAddTask} className="text-gray-400 hover:text-black dark:hover:text-white transition-default" aria-label="Save task"><Check size={14} /></button>
                <button onClick={() => { setNewTaskTitle(""); setNewTaskDate(""); setShowAddTask(false); }} className="text-gray-400 hover:text-black dark:hover:text-white transition-default" aria-label="Cancel"><X size={14} /></button>
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

      {/* Animated colour strip — always at bottom */}
      <div className="list-strip" aria-hidden="true" />
    </div>

    </>
  );
}
