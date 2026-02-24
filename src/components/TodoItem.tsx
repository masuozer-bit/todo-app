"use client";

import { useState, useRef, useEffect } from "react";
import {
  Trash2,
  GripVertical,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
} from "lucide-react";
import type { Todo, Tag, Priority } from "@/lib/types";
import TagPill from "./TagPill";

interface TodoItemProps {
  todo: Todo;
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (
    id: string,
    updates: {
      title?: string;
      due_date?: string | null;
      priority?: Priority;
      notes?: string | null;
    }
  ) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; dot: string }
> = {
  high: {
    label: "High",
    color: "text-red-500 dark:text-red-400",
    dot: "bg-red-500",
  },
  medium: {
    label: "Medium",
    color: "text-amber-500 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  low: {
    label: "Low",
    color: "text-blue-500 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  none: { label: "None", color: "text-gray-400", dot: "bg-gray-300" },
};

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
    text: due.toLocaleDateString("en", { month: "short", day: "numeric" }),
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
  dragHandleProps,
  isDragging = false,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.title);
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(todo.notes ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const subtaskRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const todoTagIds = (todo.tags ?? []).map((t) => t.id);
  const subtasks = todo.subtasks ?? [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const priorityConf = PRIORITY_CONFIG[todo.priority ?? "none"];
  const dueInfo = todo.due_date ? formatDueDate(todo.due_date) : null;

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

  function handleAddSubtask() {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    onAddSubtask(todo.id, trimmed);
    setNewSubtask("");
    setShowSubtaskInput(false);
  }

  function handleSubtaskKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAddSubtask();
    if (e.key === "Escape") {
      setNewSubtask("");
      setShowSubtaskInput(false);
    }
  }

  return (
    <div
      className={`glass-card-subtle group transition-default ${
        isDragging ? "opacity-50 scale-[1.02] shadow-lg" : ""
      } ${todo.completed ? "opacity-60" : ""}`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-3 md:p-4">
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-gray-400 opacity-0 group-hover:opacity-100 transition-default touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id, !todo.completed)}
          className="custom-checkbox mt-0.5"
          aria-label={`Mark "${todo.title}" as ${
            todo.completed ? "incomplete" : "complete"
          }`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                ref={editRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-black dark:text-white focus:outline-none text-base border-b border-black/20 dark:border-white/20 pb-0.5"
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
            <p
              className={`text-base cursor-pointer transition-default ${
                todo.completed
                  ? "line-through text-gray-400"
                  : "text-black dark:text-white"
              }`}
              onClick={() => !todo.completed && setEditing(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !todo.completed) setEditing(true);
              }}
              aria-label={`Edit "${todo.title}"`}
            >
              {todo.title}
            </p>
          )}

          {/* Meta: priority, due date, subtask count, notes */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {todo.priority && todo.priority !== "none" && (
              <span
                className={`flex items-center gap-1 text-xs font-medium ${priorityConf.color}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${priorityConf.dot}`}
                />
                {priorityConf.label}
              </span>
            )}
            {dueInfo && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  dueInfo.overdue
                    ? "text-red-500 dark:text-red-400 font-medium"
                    : "text-gray-400"
                }`}
              >
                <Calendar size={11} />
                {dueInfo.text}
              </span>
            )}
            {subtasks.length > 0 && (
              <span className="text-xs text-gray-400">
                {completedSubtasks}/{subtasks.length} subtasks
              </span>
            )}
            {todo.notes && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <FileText size={11} />
                Note
              </span>
            )}
          </div>

          {/* Tags */}
          {(todo.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(todo.tags ?? []).map((tag) => (
                <TagPill
                  key={tag.id}
                  name={tag.name}
                  size="sm"
                  onRemove={
                    !todo.completed
                      ? () => onTagToggle(todo.id, tag.id, false)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: expand + delete */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white transition-default"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="mt-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white transition-default"
            aria-label={`Delete "${todo.title}"`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-black/5 dark:border-white/5 pt-3">
          {/* Priority */}
          {!todo.completed && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                Priority
              </p>
              <div className="flex gap-2 flex-wrap">
                {(["high", "medium", "low", "none"] as Priority[]).map((p) => {
                  const conf = PRIORITY_CONFIG[p];
                  return (
                    <button
                      key={p}
                      onClick={() => onUpdate(todo.id, { priority: p })}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
                        todo.priority === p
                          ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 font-medium text-black dark:text-white"
                          : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${conf.dot}`}
                      />
                      {conf.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Due date */}
          {!todo.completed && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                Due date
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={todo.due_date ?? ""}
                  onChange={(e) =>
                    onUpdate(todo.id, { due_date: e.target.value || null })
                  }
                  className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                />
                {todo.due_date && (
                  <button
                    onClick={() => onUpdate(todo.id, { due_date: null })}
                    className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Notes
              </p>
              {!showNotes && !todo.completed && (
                <button
                  onClick={() => setShowNotes(true)}
                  className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  {todo.notes ? "Edit" : "+ Add"}
                </button>
              )}
            </div>
            {showNotes ? (
              <div>
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/30 dark:focus:border-white/30 resize-none transition-default"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleNotesSave}
                    className="text-xs px-3 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-default"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setNotesValue(todo.notes ?? "");
                      setShowNotes(false);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-default"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              todo.notes ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                  {todo.notes}
                </p>
              ) : (
                <p className="text-sm text-gray-300 dark:text-gray-600 italic">No notes</p>
              )
            )}
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Subtasks{" "}
                {subtasks.length > 0 && `(${completedSubtasks}/${subtasks.length})`}
              </p>
              {!todo.completed && (
                <button
                  onClick={() => setShowSubtaskInput(!showSubtaskInput)}
                  className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  + Add
                </button>
              )}
            </div>

            {/* Subtask progress bar */}
            {subtasks.length > 0 && (
              <div className="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full mb-3">
                <div
                  className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
                  style={{
                    width: `${(completedSubtasks / subtasks.length) * 100}%`,
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 group/subtask"
                >
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() =>
                      onToggleSubtask(
                        todo.id,
                        subtask.id,
                        !subtask.completed
                      )
                    }
                    className="custom-checkbox flex-shrink-0"
                    style={{ width: "1rem", height: "1rem" }}
                  />
                  <span
                    className={`flex-1 text-sm transition-default ${
                      subtask.completed
                        ? "line-through text-gray-400"
                        : "text-black dark:text-white"
                    }`}
                  >
                    {subtask.title}
                  </span>
                  <button
                    onClick={() => onDeleteSubtask(todo.id, subtask.id)}
                    className="opacity-0 group-hover/subtask:opacity-100 text-gray-400 hover:text-black dark:hover:text-white transition-default"
                    aria-label="Delete subtask"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {showSubtaskInput && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  ref={subtaskRef}
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={handleSubtaskKeyDown}
                  placeholder="Subtask title..."
                  className="flex-1 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-0.5 text-black dark:text-white placeholder:text-gray-400 focus:outline-none"
                />
                <button
                  onClick={handleAddSubtask}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => {
                    setNewSubtask("");
                    setShowSubtaskInput(false);
                  }}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          {!todo.completed && allTags.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const hasTag = todoTagIds.includes(tag.id);
                  return (
                    <TagPill
                      key={tag.id}
                      name={tag.name}
                      size="sm"
                      selected={hasTag}
                      onClick={() => onTagToggle(todo.id, tag.id, !hasTag)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
