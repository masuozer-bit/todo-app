"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, Sparkles, Repeat } from "lucide-react";
import type { Tag, Priority, List, RecurrenceType } from "@/lib/types";
import { getToday, getTomorrow, getNextMonday, getNextWeek, parseNaturalLanguage } from "@/lib/date-helpers";
import TagPill from "./TagPill";

interface TodoInputProps {
  onAdd: (
    title: string,
    tagIds: string[],
    options?: {
      due_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      priority?: Priority;
      notes?: string | null;
      list_id?: string | null;
      recurrence_type?: RecurrenceType | null;
      recurrence_interval?: number | null;
    }
  ) => void;
  tags: Tag[];
  lists?: List[];
  activeListId?: string | null;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "none", label: "No priority" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType | "none"; label: string }[] = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function TodoInput({
  onAdd,
  tags,
  lists = [],
  activeListId,
}: TodoInputProps) {
  const [title, setTitle] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [notes, setNotes] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | "none">("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [nlHint, setNlHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Natural language preview
  useEffect(() => {
    if (!title.trim()) {
      setNlHint(null);
      return;
    }
    const parsed = parseNaturalLanguage(title);
    const hints: string[] = [];
    if (parsed.due_date) hints.push(parsed.due_date === getToday() ? "Today" : parsed.due_date);
    if (parsed.start_time) hints.push(parsed.start_time);
    if (parsed.priority && parsed.priority !== "none") hints.push(`!${parsed.priority}`);
    if (parsed.tagNames && parsed.tagNames.length > 0) hints.push(parsed.tagNames.map(t => `#${t}`).join(" "));
    if (parsed.recurrence_type) hints.push(`↻ ${parsed.recurrence_type}`);
    setNlHint(hints.length > 0 ? hints.join(" · ") : null);
  }, [title]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    // If options panel is NOT open, try natural language parsing
    let finalTitle = trimmed;
    let finalDueDate = dueDate || null;
    let finalStartTime = startTime || null;
    let finalEndTime = endTime || null;
    let finalPriority = priority;
    let finalTagIds = [...selectedTagIds];
    let finalRecurrenceType: RecurrenceType | null = recurrenceType === "none" ? null : recurrenceType;
    let finalRecurrenceInterval: number | null = recurrenceType === "none" ? null : recurrenceInterval;

    if (!showOptions) {
      const parsed = parseNaturalLanguage(trimmed);
      if (parsed.title) finalTitle = parsed.title;
      if (parsed.due_date) finalDueDate = parsed.due_date;
      if (parsed.start_time) finalStartTime = parsed.start_time;
      if (parsed.priority && parsed.priority !== "none") finalPriority = parsed.priority;
      if (parsed.recurrence_type) {
        finalRecurrenceType = parsed.recurrence_type;
        finalRecurrenceInterval = parsed.recurrence_interval ?? 1;
      }
      // Match tag names to existing tags
      if (parsed.tagNames && parsed.tagNames.length > 0) {
        for (const name of parsed.tagNames) {
          const tag = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
          if (tag && !finalTagIds.includes(tag.id)) {
            finalTagIds.push(tag.id);
          }
        }
      }
    }

    onAdd(finalTitle, finalTagIds, {
      due_date: finalDueDate,
      start_time: finalStartTime,
      end_time: finalEndTime,
      priority: finalPriority,
      notes: notes.trim() || null,
      list_id: activeListId ?? null,
      recurrence_type: finalRecurrenceType,
      recurrence_interval: finalRecurrenceInterval,
    });
    setTitle("");
    setSelectedTagIds([]);
    setDueDate("");
    setStartTime("");
    setEndTime("");
    setPriority("none");
    setNotes("");
    setRecurrenceType("none");
    setRecurrenceInterval(1);
    setShowOptions(false);
    inputRef.current?.focus();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  return (
    <div className="glass-card p-4">
      <form onSubmit={handleSubmit}>
        {/* Title row */}
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new task... (try: Buy groceries tomorrow at 3pm !high #shopping)"
            className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
            aria-label="New task title"
          />

          {/* Toggle options */}
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
            aria-label={showOptions ? "Hide options" : "Show options"}
          >
            {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 active:scale-95 transition-default disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Add task"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Natural language hint */}
        {!showOptions && nlHint && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <Sparkles size={11} className="text-amber-400" />
            <span>{nlHint}</span>
          </div>
        )}

        {/* Expanded options */}
        {showOptions && (
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-3">
            {/* Priority + Due date row */}
            <div className="flex flex-wrap gap-3">
              {/* Priority */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-medium">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="text-xs bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default cursor-pointer"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-medium">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                />
              </div>

              {/* Start time (only shown when due date is set) */}
              {dueDate && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400 font-medium">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                  />
                </div>
              )}

              {/* End time (only shown when start time is set) */}
              {dueDate && startTime && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400 font-medium">
                    End time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                  />
                </div>
              )}

              {/* Recurrence */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-medium">
                  Repeat
                </label>
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType | "none")}
                  className="text-xs bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default cursor-pointer"
                >
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick-pick date buttons */}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1.5">
                Quick date
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Today", fn: getToday },
                  { label: "Tomorrow", fn: getTomorrow },
                  { label: "Next Mon", fn: getNextMonday },
                  { label: "Next Week", fn: getNextWeek },
                  { label: "No date", fn: () => "" },
                ].map((pick) => (
                  <button
                    key={pick.label}
                    type="button"
                    onClick={() => {
                      const val = pick.fn();
                      setDueDate(val);
                      if (!val) {
                        setStartTime("");
                        setEndTime("");
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                      dueDate === pick.fn()
                        ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                        : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                    }`}
                  >
                    {pick.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400 font-medium">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note..."
                rows={2}
                className="w-full text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/30 dark:focus:border-white/30 resize-none transition-default"
              />
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1.5">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <TagPill
                      key={tag.id}
                      name={tag.name}
                      selected={selectedTagIds.includes(tag.id)}
                      onClick={() => toggleTag(tag.id)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
