"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Flag,
  Hash,
  Repeat,
  List as ListIcon,
  X,
} from "lucide-react";
import type { Tag, Priority, List, RecurrenceType } from "@/lib/types";
import {
  getToday,
  getTomorrow,
  getNextMonday,
  getNextWeek,
  parseNaturalLanguage,
  type ParsedTask,
} from "@/lib/date-helpers";
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

const RECURRENCE_OPTIONS: {
  value: RecurrenceType | "none";
  label: string;
}[] = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40",
  medium:
    "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
  low: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
  none: "",
};

// Suggestions that appear while typing
interface Suggestion {
  trigger: string;
  display: string;
  insert: string;
}

function buildSuggestions(
  input: string,
  tags: Tag[],
  lists: List[]
): Suggestion[] {
  if (!input.trim()) return [];
  const words = input.split(/\s+/);
  const lastWord = words[words.length - 1].toLowerCase();
  if (!lastWord) return [];

  const suggestions: Suggestion[] = [];

  // Date suggestions
  if ("today".startsWith(lastWord) && lastWord.length >= 2 && lastWord !== "today") {
    suggestions.push({ trigger: lastWord, display: "today", insert: "today" });
  }
  if ("tomorrow".startsWith(lastWord) && lastWord.length >= 2 && lastWord !== "tomorrow") {
    suggestions.push({ trigger: lastWord, display: "tomorrow", insert: "tomorrow" });
  }

  // "next" suggestions
  if (lastWord === "next") {
    suggestions.push(
      { trigger: lastWord, display: "next monday", insert: "next monday" },
      { trigger: lastWord, display: "next week", insert: "next week" }
    );
  }

  // Priority suggestions
  if (lastWord === "!" || lastWord === "!h" || lastWord === "!hi") {
    suggestions.push({ trigger: lastWord, display: "!high", insert: "!high" });
  }
  if (lastWord === "!" || lastWord === "!m" || lastWord === "!me") {
    suggestions.push({
      trigger: lastWord,
      display: "!medium",
      insert: "!medium",
    });
  }
  if (lastWord === "!" || lastWord === "!l" || lastWord === "!lo") {
    suggestions.push({ trigger: lastWord, display: "!low", insert: "!low" });
  }

  // Tag suggestions
  if (lastWord.startsWith("#") && lastWord.length >= 1) {
    const partial = lastWord.slice(1).toLowerCase();
    for (const tag of tags) {
      if (
        partial === "" ||
        tag.name.toLowerCase().startsWith(partial)
      ) {
        if (`#${tag.name.toLowerCase()}` !== lastWord) {
          suggestions.push({
            trigger: lastWord,
            display: `#${tag.name}`,
            insert: `#${tag.name}`,
          });
        }
      }
    }
  }

  // Recurrence suggestions
  if ("every".startsWith(lastWord) && lastWord.length >= 2 && lastWord !== "every") {
    suggestions.push(
      { trigger: lastWord, display: "every day", insert: "every day" },
      { trigger: lastWord, display: "every week", insert: "every week" }
    );
  }
  if (lastWord === "every") {
    suggestions.push(
      { trigger: lastWord, display: "every day", insert: "every day" },
      { trigger: lastWord, display: "every week", insert: "every week" },
      { trigger: lastWord, display: "every month", insert: "every month" }
    );
  }

  // Time suggestions
  if (lastWord === "at") {
    suggestions.push(
      { trigger: lastWord, display: "at 9am", insert: "at 9am" },
      { trigger: lastWord, display: "at 3pm", insert: "at 3pm" },
      { trigger: lastWord, display: "at 6pm", insert: "at 6pm" }
    );
  }

  return suggestions.slice(0, 5);
}

function formatDateLabel(dateStr: string): string {
  const today = getToday();
  const tomorrow = getTomorrow();
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":");
  const hours = parseInt(h);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hr = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hr}:${m} ${suffix}`;
}

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
  const [recurrenceType, setRecurrenceType] = useState<
    RecurrenceType | "none"
  >("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [listId, setListId] = useState<string | null>(activeListId ?? null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync listId when activeListId changes
  useEffect(() => {
    setListId(activeListId ?? null);
  }, [activeListId]);

  // Parse NL in real time
  const parsed: ParsedTask | null = useMemo(() => {
    if (!title.trim() || showOptions) return null;
    const p = parseNaturalLanguage(title);
    // Only return if something was actually detected
    if (
      p.due_date ||
      p.start_time ||
      (p.priority && p.priority !== "none") ||
      (p.tagNames && p.tagNames.length > 0) ||
      p.recurrence_type
    ) {
      return p;
    }
    return null;
  }, [title, showOptions]);

  // Suggestions
  const suggestions = useMemo(() => {
    if (showOptions || !title.trim()) return [];
    return buildSuggestions(title, tags, lists);
  }, [title, tags, lists, showOptions]);

  useEffect(() => {
    setSelectedSuggestion(0);
    setShowSuggestions(suggestions.length > 0);
  }, [suggestions]);

  function applySuggestion(suggestion: Suggestion) {
    const words = title.split(/\s+/);
    // If the trigger is "next" and the insert is "next monday", we need to remove "next" and add "next monday"
    // Just replace the last word(s) that match the trigger
    const triggerWordCount = suggestion.trigger.split(/\s+/).length;
    const newWords = words.slice(0, words.length - triggerWordCount);
    newWords.push(suggestion.insert);
    setTitle(newWords.join(" ") + " ");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "Tab" || (e.key === "ArrowRight" && suggestions.length > 0)) {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestion]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    let finalTitle = trimmed;
    let finalDueDate = dueDate || null;
    let finalStartTime = startTime || null;
    let finalEndTime = endTime || null;
    let finalPriority = priority;
    let finalTagIds = [...selectedTagIds];
    let finalRecurrenceType: RecurrenceType | null =
      recurrenceType === "none" ? null : recurrenceType;
    let finalRecurrenceInterval: number | null =
      recurrenceType === "none" ? null : recurrenceInterval;

    if (!showOptions) {
      const p = parseNaturalLanguage(trimmed);
      if (p.title) finalTitle = p.title;
      if (p.due_date) finalDueDate = p.due_date;
      if (p.start_time) finalStartTime = p.start_time;
      if (p.priority && p.priority !== "none") finalPriority = p.priority;
      if (p.recurrence_type) {
        finalRecurrenceType = p.recurrence_type;
        finalRecurrenceInterval = p.recurrence_interval ?? 1;
      }
      if (p.tagNames && p.tagNames.length > 0) {
        for (const name of p.tagNames) {
          const tag = tags.find(
            (t) => t.name.toLowerCase() === name.toLowerCase()
          );
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
      list_id: listId ?? activeListId ?? null,
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
    setListId(activeListId ?? null);
    setShowOptions(false);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  const activeListName = lists.find((l) => l.id === listId)?.name;

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
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Add a task... (try: Buy milk tomorrow at 3pm !high #shopping)"
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
            {showOptions ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
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

        {/* Autocomplete suggestions dropdown */}
        {!showOptions && showSuggestions && suggestions.length > 0 && (
          <div className="mt-1.5 bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={s.display + i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(s)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-default ${
                  i === selectedSuggestion
                    ? "bg-black/5 dark:bg-white/10 text-black dark:text-white"
                    : "text-gray-500 dark:text-gray-400 hover:bg-black/[0.03] dark:hover:bg-white/5"
                }`}
              >
                <span className="font-medium">{s.display}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  Tab ↹
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Rich NL live preview pills */}
        {!showOptions && parsed && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 mr-0.5 font-medium">
              Parsed:
            </span>
            {/* Cleaned title */}
            {parsed.title && parsed.title !== title.trim() && (
              <span className="text-xs text-black dark:text-white font-medium bg-black/[0.04] dark:bg-white/[0.08] px-2 py-0.5 rounded-md border border-black/5 dark:border-white/10 truncate max-w-[200px]">
                &ldquo;{parsed.title}&rdquo;
              </span>
            )}
            {/* Date pill */}
            {parsed.due_date && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40">
                <Calendar size={10} />
                {formatDateLabel(parsed.due_date)}
              </span>
            )}
            {/* Time pill */}
            {parsed.start_time && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/40">
                <Clock size={10} />
                {formatTimeLabel(parsed.start_time)}
              </span>
            )}
            {/* Priority pill */}
            {parsed.priority && parsed.priority !== "none" && (
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${PRIORITY_COLORS[parsed.priority]}`}
              >
                <Flag size={10} />
                {parsed.priority.charAt(0).toUpperCase() +
                  parsed.priority.slice(1)}
              </span>
            )}
            {/* Tag pills */}
            {parsed.tagNames?.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/40"
              >
                <Hash size={10} />
                {name}
              </span>
            ))}
            {/* Recurrence pill */}
            {parsed.recurrence_type && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40">
                <Repeat size={10} />
                {parsed.recurrence_type.charAt(0).toUpperCase() +
                  parsed.recurrence_type.slice(1)}
              </span>
            )}
          </div>
        )}

        {/* List selector (always visible when lists exist, in both modes) */}
        {lists.length > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <ListIcon size={12} className="text-gray-400 flex-shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setListId(null)}
                className={`text-[11px] px-2 py-0.5 rounded-md border transition-default ${
                  !listId
                    ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                    : "border-black/8 dark:border-white/8 text-gray-400 hover:border-black/15 dark:hover:border-white/15"
                }`}
              >
                No list
              </button>
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setListId(list.id)}
                  className={`text-[11px] px-2 py-0.5 rounded-md border transition-default ${
                    listId === list.id
                      ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                      : "border-black/8 dark:border-white/8 text-gray-400 hover:border-black/15 dark:hover:border-white/15"
                  }`}
                >
                  {list.name}
                </button>
              ))}
            </div>
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

              {/* Start time */}
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

              {/* End time */}
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
                  onChange={(e) =>
                    setRecurrenceType(
                      e.target.value as RecurrenceType | "none"
                    )
                  }
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
