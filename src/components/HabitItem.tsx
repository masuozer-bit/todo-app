"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, Check, X, Flame, Repeat, Clock, FileText, ChevronDown, Settings2, Minus, Plus } from "lucide-react";
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
      time?: string | null;
      end_time?: string | null;
      notes?: string | null;
    }
  ) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  highlighted?: boolean;
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

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function HabitItem({
  habit,
  onToggle,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging = false,
  highlighted = false,
}: HabitItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(habit.title);
  const [editTime, setEditTime] = useState(habit.time ?? "");
  const [editEndTime, setEditEndTime] = useState(habit.end_time ?? "");
  const [editNotes, setEditNotes] = useState(habit.notes ?? "");
  const [showNotes, setShowNotes] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editScheduleType, setEditScheduleType] = useState<ScheduleType>(habit.schedule_type);
  const [editScheduleDays, setEditScheduleDays] = useState<number[]>(habit.schedule_days);
  const [editScheduleInterval, setEditScheduleInterval] = useState(habit.schedule_interval || 1);
  const editRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const cancelledRef = useRef(false);

  // Sync local state when habit changes externally
  useEffect(() => {
    setEditValue(habit.title);
    setEditTime(habit.time ?? "");
    setEditEndTime(habit.end_time ?? "");
    setEditNotes(habit.notes ?? "");
    setEditScheduleType(habit.schedule_type);
    setEditScheduleDays(habit.schedule_days);
    setEditScheduleInterval(habit.schedule_interval || 1);
  }, [habit.title, habit.time, habit.end_time, habit.notes, habit.schedule_type, habit.schedule_days, habit.schedule_interval]);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editingNotes) notesRef.current?.focus();
  }, [editingNotes]);

  function handleSaveTitle() {
    if (cancelledRef.current) { cancelledRef.current = false; return; }
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== habit.title) {
      onUpdate(habit.id, { title: trimmed });
    } else {
      setEditValue(habit.title);
    }
    setEditing(false);
  }

  function handleSaveTime(newTime: string) {
    const val = newTime || null;
    if (val !== (habit.time ?? null)) {
      onUpdate(habit.id, { time: val, ...(val === null ? { end_time: null } : {}) });
      if (val === null) setEditEndTime("");
    }
  }

  function handleSaveEndTime(newEndTime: string) {
    const val = newEndTime || null;
    if (val !== (habit.end_time ?? null)) {
      onUpdate(habit.id, { end_time: val });
    }
  }

  function handleSaveNotes() {
    const trimmed = editNotes.trim() || null;
    if (trimmed !== (habit.notes ?? null)) {
      onUpdate(habit.id, { notes: trimmed });
    }
    setEditingNotes(false);
  }

  function handleSaveSchedule() {
    onUpdate(habit.id, {
      schedule_type: editScheduleType,
      schedule_days: editScheduleType === "weekly" ? editScheduleDays : [],
      schedule_interval: editScheduleType === "interval" ? editScheduleInterval : 1,
    });
    setEditingSchedule(false);
  }

  function toggleScheduleDay(day: number) {
    setEditScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSaveTitle();
    if (e.key === "Escape") { setEditValue(habit.title); setEditing(false); }
  }

  const hasNotes = !!(habit.notes?.trim());

  return (
    <div
      ref={itemRef}
      data-habit-id={habit.id}
      className={`glass-card-subtle group transition-default ${
        isDragging ? "opacity-50 scale-[1.02] shadow-lg" : ""
      } ${habit.completedToday ? "opacity-60" : ""}`}
      style={highlighted ? { outline: "2px solid rgba(139,92,246,0.65)", outlineOffset: "2px" } : undefined}
    >
      <div className="flex items-start gap-3 p-3 md:p-4 touch-none" {...dragHandleProps}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={habit.completedToday}
          onChange={() => onToggle(habit.id)}
          className="custom-checkbox mt-0.5 flex-shrink-0"
          aria-label={`Mark "${habit.title}" as ${habit.completedToday ? "incomplete" : "complete"} for today`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                ref={editRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-black dark:text-white focus:outline-none text-base border-b border-black/20 dark:border-white/20 pb-0.5"
                aria-label="Edit habit title"
              />
              <button onClick={handleSaveTitle} className="text-black/40 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default" aria-label="Save">
                <Check size={16} />
              </button>
              <button
                onMouseDown={() => { cancelledRef.current = true; }}
                onClick={() => { setEditValue(habit.title); setEditing(false); cancelledRef.current = false; }}
                className="text-black/40 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <p
              className={`text-base cursor-pointer transition-default leading-snug ${
                habit.completedToday ? "line-through text-black/40 dark:text-gray-500" : "text-black dark:text-white"
              }`}
              onClick={() => setEditing(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
              aria-label={`Edit "${habit.title}"`}
            >
              {habit.title}
            </p>
          )}

          {/* Meta row: schedule + time + streak */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <button
              type="button"
              onClick={() => setEditingSchedule((v) => !v)}
              className="flex items-center gap-1 text-xs text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
              aria-label="Edit schedule"
            >
              <Repeat size={10} />
              {formatSchedule(habit)}
              <Settings2 size={9} className="opacity-50" />
            </button>

            {/* Time — click to edit inline */}
            <button
              type="button"
              onClick={() => {
                const inp = document.getElementById(`habit-time-${habit.id}`) as HTMLInputElement | null;
                inp?.showPicker?.();
                inp?.click();
              }}
              className="flex items-center gap-1 text-xs text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
              aria-label={habit.time ? "Edit start time" : "Add time"}
            >
              <Clock size={10} />
              {habit.time ? (
                <>
                  {formatTime12(habit.time)}
                  {habit.end_time && (
                    <span className="opacity-70">–{formatTime12(habit.end_time)}</span>
                  )}
                </>
              ) : (
                <span className="opacity-50">Add time</span>
              )}
            </button>
            {/* Hidden start time input */}
            <input
              id={`habit-time-${habit.id}`}
              type="time"
              value={editTime}
              onChange={(e) => {
                setEditTime(e.target.value);
                handleSaveTime(e.target.value);
              }}
              className="sr-only"
              aria-label="Set habit start time"
            />
            {/* End time — only shown when start time is set */}
            {habit.time && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const inp = document.getElementById(`habit-end-time-${habit.id}`) as HTMLInputElement | null;
                    inp?.showPicker?.();
                    inp?.click();
                  }}
                  className="flex items-center gap-1 text-xs text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
                  aria-label={habit.end_time ? "Edit end time" : "Add end time"}
                >
                  {!habit.end_time && <span className="opacity-40 text-[10px]">+ end</span>}
                </button>
                <input
                  id={`habit-end-time-${habit.id}`}
                  type="time"
                  value={editEndTime}
                  onChange={(e) => {
                    setEditEndTime(e.target.value);
                    handleSaveEndTime(e.target.value);
                  }}
                  className="sr-only"
                  aria-label="Set habit end time"
                />
              </>
            )}

            {habit.streak > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-500 dark:text-orange-400">
                <Flame size={10} />
                {habit.streak}
              </span>
            )}

            {/* Notes toggle */}
            <button
              type="button"
              onClick={() => { setShowNotes((v) => !v); if (!showNotes && !editingNotes) setEditingNotes(false); }}
              className={`flex items-center gap-1 text-xs transition-default ${
                hasNotes
                  ? "text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white"
                  : "text-black/25 dark:text-gray-600 hover:text-black/50 dark:hover:text-gray-400"
              }`}
              aria-label={showNotes ? "Hide notes" : hasNotes ? "Show notes" : "Add notes"}
            >
              <FileText size={10} />
              {hasNotes ? (
                <span className="flex items-center gap-0.5">
                  Notes
                  <ChevronDown size={9} className={`transition-transform duration-150 ${showNotes ? "rotate-180" : ""}`} />
                </span>
              ) : (
                <span className="opacity-60">Add notes</span>
              )}
            </button>
          </div>

          {/* Schedule editing panel */}
          {editingSchedule && (
            <div className="mt-2 p-3 bg-black/[0.04] dark:bg-white/[0.04] rounded-lg space-y-3">
              {/* Rhythm toggle */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40 dark:text-gray-500 mb-1.5">Rhythm</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditScheduleType("interval")}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                      editScheduleType === "interval"
                        ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 font-medium text-black dark:text-white"
                        : "border-black/10 dark:border-white/10 text-black/50 dark:text-gray-400"
                    }`}
                  >
                    Every X days
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditScheduleType("weekly")}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                      editScheduleType === "weekly"
                        ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 font-medium text-black dark:text-white"
                        : "border-black/10 dark:border-white/10 text-black/50 dark:text-gray-400"
                    }`}
                  >
                    Specific days
                  </button>
                </div>
              </div>

              {editScheduleType === "interval" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40 dark:text-gray-500 mb-1.5">Repeat every</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditScheduleInterval((p) => Math.max(1, p - 1))}
                      className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-black dark:text-white tabular-nums">{editScheduleInterval}</span>
                    <button
                      type="button"
                      onClick={() => setEditScheduleInterval((p) => Math.min(30, p + 1))}
                      className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-black/50 dark:text-gray-400 hover:text-black dark:hover:text-white transition-default"
                    >
                      <Plus size={12} />
                    </button>
                    <span className="text-xs text-black/50 dark:text-gray-400">{editScheduleInterval === 1 ? "day" : "days"}</span>
                  </div>
                </div>
              )}

              {editScheduleType === "weekly" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40 dark:text-gray-500 mb-1.5">Days</p>
                  <div className="flex gap-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleScheduleDay(i)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-default ${
                          editScheduleDays.includes(i)
                            ? "bg-black dark:bg-white text-white dark:text-black"
                            : "border border-black/10 dark:border-white/10 text-black/50 dark:text-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button onClick={handleSaveSchedule} className="text-xs px-2.5 py-1 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90 transition-default">
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditScheduleType(habit.schedule_type);
                    setEditScheduleDays(habit.schedule_days);
                    setEditScheduleInterval(habit.schedule_interval || 1);
                    setEditingSchedule(false);
                  }}
                  className="text-xs text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Notes panel */}
          {showNotes && (
            <div className="mt-2">
              {editingNotes ? (
                <div className="space-y-1">
                  <textarea
                    ref={notesRef}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setEditNotes(habit.notes ?? ""); setEditingNotes(false); }
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveNotes();
                    }}
                    placeholder="Add notes or context..."
                    rows={3}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-2 text-xs text-black dark:text-white placeholder:text-black/25 dark:placeholder:text-gray-600 focus:outline-none focus:border-black/25 dark:focus:border-white/20 transition-default resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={handleSaveNotes} className="text-xs px-2.5 py-1 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium hover:opacity-90 transition-default">
                      Save
                    </button>
                    <button
                      onClick={() => { setEditNotes(habit.notes ?? ""); setEditingNotes(false); }}
                      className="text-xs text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-black/25 dark:text-gray-600 ml-auto">⌘↵ to save</span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingNotes(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingNotes(true); }}
                  className="text-xs text-black/60 dark:text-gray-400 bg-black/[0.04] dark:bg-white/[0.04] rounded-lg px-2.5 py-2 cursor-text hover:bg-black/[0.07] dark:hover:bg-white/[0.07] transition-default whitespace-pre-wrap"
                  aria-label="Edit notes"
                >
                  {hasNotes ? habit.notes : <span className="text-black/25 dark:text-gray-600 italic">Click to add notes…</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(habit.id)}
          className="mt-0.5 text-black/25 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white transition-default flex-shrink-0"
          aria-label={`Delete "${habit.title}"`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
