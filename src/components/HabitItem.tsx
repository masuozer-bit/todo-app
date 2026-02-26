"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, Check, X, Flame, Repeat } from "lucide-react";
import type { HabitWithStatus, ScheduleType } from "@/lib/types";

interface HabitItemProps {
  habit: HabitWithStatus;
  onToggle: (habitId: string) => void;
  onUpdate: (
    id: string,
    updates: {
      title?: string;
      schedule_type?: ScheduleType;
      schedule_days?: number[];
      schedule_interval?: number;
    }
  ) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSchedule(habit: HabitWithStatus): string {
  if (habit.schedule_type === "weekly") {
    return habit.schedule_days.map((d) => DAY_LABELS[d]).join(", ");
  }
  const interval = habit.schedule_interval || 1;
  if (interval === 1) return "Daily";
  return `Every ${interval} days`;
}

export default function HabitItem({
  habit,
  onToggle,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging = false,
}: HabitItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(habit.title);
  const editRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  function handleSave() {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== habit.title) {
      onUpdate(habit.id, { title: trimmed });
    } else {
      setEditValue(habit.title);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(habit.title);
      setEditing(false);
    }
  }

  return (
    <div
      className={`glass-card-subtle group transition-default ${
        isDragging ? "opacity-50 scale-[1.02] shadow-lg" : ""
      } ${habit.completedToday ? "opacity-60" : ""}`}
    >
      <div
        className="flex items-start gap-3 p-3 md:p-4 touch-none"
        {...dragHandleProps}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={habit.completedToday}
          onChange={() => onToggle(habit.id)}
          className="custom-checkbox mt-0.5"
          aria-label={`Mark "${habit.title}" as ${habit.completedToday ? "incomplete" : "complete"} for today`}
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
                aria-label="Edit habit title"
              />
              <button
                onClick={handleSave}
                className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
                aria-label="Save edit"
              >
                <Check size={16} />
              </button>
              <button
                onMouseDown={() => {
                  cancelledRef.current = true;
                }}
                onClick={() => {
                  setEditValue(habit.title);
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
                habit.completedToday
                  ? "line-through text-gray-400"
                  : "text-black dark:text-white"
              }`}
              onClick={() => setEditing(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditing(true);
              }}
              aria-label={`Edit "${habit.title}"`}
            >
              {habit.title}
            </p>
          )}

          {/* Meta: schedule + streak */}
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Repeat size={11} />
              {formatSchedule(habit)}
            </span>
            {habit.streak > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Flame size={11} />
                {habit.streak} day{habit.streak !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(habit.id)}
          className="mt-0.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white transition-default"
          aria-label={`Delete "${habit.title}"`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
