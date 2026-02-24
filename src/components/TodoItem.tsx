"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, GripVertical, Check, X } from "lucide-react";
import type { Todo, Tag } from "@/lib/types";
import TagPill from "./TagPill";

interface TodoItemProps {
  todo: Todo;
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export default function TodoItem({
  todo,
  allTags,
  onToggle,
  onUpdate,
  onDelete,
  onTagToggle,
  dragHandleProps,
  isDragging = false,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.title);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const todoTagIds = (todo.tags ?? []).map((t) => t.id);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== todo.title) {
      onUpdate(todo.id, trimmed);
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

  return (
    <div
      className={`glass-card-subtle p-3 md:p-4 group transition-default ${
        isDragging ? "opacity-50 scale-[1.02] shadow-lg" : ""
      } ${todo.completed ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-3">
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
                onClick={() => {
                  setEditValue(todo.title);
                  setEditing(false);
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

          {/* Tags on item */}
          {(todo.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(todo.tags ?? []).map((tag) => (
                <TagPill
                  key={tag.id}
                  name={tag.name}
                  size="sm"
                  onRemove={() => onTagToggle(todo.id, tag.id, false)}
                />
              ))}
            </div>
          )}

          {/* Tag picker toggle */}
          {!todo.completed && allTags.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
              >
                {showTagPicker ? "Hide tags" : "+ Tag"}
              </button>

              {showTagPicker && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {allTags
                    .filter((t) => !todoTagIds.includes(t.id))
                    .map((tag) => (
                      <TagPill
                        key={tag.id}
                        name={tag.name}
                        size="sm"
                        onClick={() => {
                          onTagToggle(todo.id, tag.id, true);
                          setShowTagPicker(false);
                        }}
                      />
                    ))}
                  {allTags.filter((t) => !todoTagIds.includes(t.id)).length ===
                    0 && (
                    <span className="text-xs text-gray-400">
                      All tags assigned
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(todo.id)}
          className="flex-shrink-0 mt-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white transition-default"
          aria-label={`Delete "${todo.title}"`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
