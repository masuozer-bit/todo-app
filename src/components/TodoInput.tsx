"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Hash,
  X,
  List as ListIcon,
  CalendarRange,
} from "lucide-react";
import type { Tag, Priority, List, Event } from "@/lib/types";
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
      start_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      priority?: Priority;
      notes?: string | null;
      list_id?: string | null;
      event_id?: string | null;
    }
  ) => Promise<string | void> | void;
  onAddSubtask?: (todoId: string, title: string, options?: { due_date?: string | null; start_time?: string | null }) => void;
  tags: Tag[];
  lists?: List[];
  events?: Event[];
  activeListId?: string | null;
  onRefetchEvents?: () => void;
}

type SubtaskEntry = { id: string; title: string; due_date: string; start_time: string };

const PRIORITY_CONFIG: {
  value: Priority;
  label: string;
  dot: string;
  active: string;
}[] = [
  {
    value: "none",
    label: "None",
    dot: "bg-gray-300 dark:bg-gray-600",
    active:
      "bg-black/5 dark:bg-white/10 text-black dark:text-white border-black/10 dark:border-white/10",
  },
  {
    value: "low",
    label: "Low",
    dot: "bg-blue-500",
    active:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
  },
  {
    value: "medium",
    label: "Med",
    dot: "bg-amber-500",
    active:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
  },
  {
    value: "high",
    label: "High",
    dot: "bg-red-500",
    active:
      "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40",
  },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40",
  medium:
    "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
  low: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
  none: "",
};

interface Suggestion {
  trigger: string;
  display: string;
  insert: string;
  listId?: string;
  eventId?: string;
}

function buildSuggestions(
  input: string,
  tags: Tag[],
  lists: List[],
  events: Event[]
): Suggestion[] {
  if (!input.trim()) return [];
  const words = input.split(/\s+/);
  const lastWord = words[words.length - 1].toLowerCase();
  if (!lastWord) return [];

  const suggestions: Suggestion[] = [];

  // List assignment: #ListName
  if (lastWord.startsWith("#")) {
    const partial = lastWord.slice(1).toLowerCase();
    for (const list of lists) {
      if (partial === "" || list.name.toLowerCase().startsWith(partial)) {
        suggestions.push({
          trigger: words[words.length - 1],
          display: `#${list.name}`,
          insert: "",
          listId: list.id,
        });
      }
    }
    return suggestions.slice(0, 5);
  }

  // Event assignment: @EventName
  if (lastWord.startsWith("@")) {
    const partial = lastWord.slice(1).toLowerCase();
    for (const ev of events) {
      if (partial === "" || ev.title.toLowerCase().startsWith(partial)) {
        suggestions.push({
          trigger: words[words.length - 1],
          display: `@${ev.title}`,
          insert: "",
          eventId: ev.id,
        });
      }
    }
    return suggestions.slice(0, 5);
  }

  if ("today".startsWith(lastWord) && lastWord.length >= 2 && lastWord !== "today")
    suggestions.push({ trigger: lastWord, display: "today", insert: "today" });
  if ("tomorrow".startsWith(lastWord) && lastWord.length >= 2 && lastWord !== "tomorrow")
    suggestions.push({ trigger: lastWord, display: "tomorrow", insert: "tomorrow" });
  if (lastWord === "next") {
    suggestions.push(
      { trigger: lastWord, display: "next monday", insert: "next monday" },
      { trigger: lastWord, display: "next week", insert: "next week" }
    );
  }
  if (lastWord === "!" || lastWord === "!h" || lastWord === "!hi")
    suggestions.push({ trigger: lastWord, display: "!high", insert: "!high" });
  if (lastWord === "!" || lastWord === "!m" || lastWord === "!me")
    suggestions.push({ trigger: lastWord, display: "!medium", insert: "!medium" });
  if (lastWord === "!" || lastWord === "!l" || lastWord === "!lo")
    suggestions.push({ trigger: lastWord, display: "!low", insert: "!low" });

  if (lastWord.startsWith("#") && lastWord.length >= 1) {
    const partial = lastWord.slice(1).toLowerCase();
    for (const tag of tags) {
      if (partial === "" || tag.name.toLowerCase().startsWith(partial)) {
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

const QUICK_DATES = [
  { label: "Today", fn: getToday },
  { label: "Tomorrow", fn: getTomorrow },
  { label: "Mon", fn: getNextMonday },
  { label: "Next Week", fn: getNextWeek },
];

export default function TodoInput({
  onAdd,
  onAddSubtask,
  tags,
  lists = [],
  events = [],
  activeListId,
  onRefetchEvents,
}: TodoInputProps) {
  const [title, setTitle] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [notes, setNotes] = useState("");
  const [listId, setListId] = useState<string | null>(activeListId ?? null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [subtaskEntries, setSubtaskEntries] = useState<SubtaskEntry[]>([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomStart, setShowCustomStart] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setListId(activeListId ?? null); }, [activeListId]);


  const parsed: ParsedTask | null = useMemo(() => {
    if (!title.trim() || showOptions) return null;
    const p = parseNaturalLanguage(title);
    if (
      p.due_date ||
      p.start_time ||
      p.end_time ||
      (p.priority && p.priority !== "none") ||
      (p.tagNames && p.tagNames.length > 0)
    ) return p;
    return null;
  }, [title, showOptions]);

  const suggestions = useMemo(() => {
    if (showOptions || !title.trim()) return [];
    return buildSuggestions(title, tags, lists, events);
  }, [title, tags, lists, events, showOptions]);

  useEffect(() => {
    setSelectedSuggestion(0);
    setShowSuggestions(suggestions.length > 0);
  }, [suggestions]);

  function applySuggestion(suggestion: Suggestion) {
    const words = title.split(/\s+/);
    const triggerWordCount = suggestion.trigger.split(/\s+/).length;
    const newWords = words.slice(0, words.length - triggerWordCount);
    if (suggestion.insert) newWords.push(suggestion.insert);
    const joined = newWords.join(" ");
    setTitle(joined ? joined + " " : "");
    if (suggestion.listId) setListId(suggestion.listId);
    if (suggestion.eventId) {
      setEventId(suggestion.eventId);
      const ev = events.find((x) => x.id === suggestion.eventId);
      if (ev?.list_id) setListId(ev.list_id);
    }
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
        setSelectedSuggestion((prev) => prev < suggestions.length - 1 ? prev + 1 : 0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((prev) => prev > 0 ? prev - 1 : suggestions.length - 1);
        return;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    let finalTitle = trimmed;
    let finalDueDate = dueDate || null;
    let finalStartDate = startDate || null;
    let finalStartTime = startTime || null;
    let finalEndTime = endTime || null;
    let finalPriority = priority;
    let finalTagIds = [...selectedTagIds];

    if (!showOptions) {
      const p = parseNaturalLanguage(trimmed);
      if (p.title) finalTitle = p.title;
      if (p.due_date) finalDueDate = p.due_date;
      if (p.start_time) finalStartTime = p.start_time;
      if (p.end_time) finalEndTime = p.end_time;
      if (p.priority && p.priority !== "none") finalPriority = p.priority;
      if (p.tagNames && p.tagNames.length > 0) {
        for (const name of p.tagNames) {
          const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
          if (tag && !finalTagIds.includes(tag.id)) finalTagIds.push(tag.id);
        }
      }
    }

    const newTodoId = await onAdd(finalTitle, finalTagIds, {
      due_date: finalDueDate,
      start_date: finalStartDate,
      start_time: finalStartTime,
      end_time: finalEndTime,
      priority: finalPriority,
      notes: notes.trim() || null,
      list_id: listId,
      event_id: eventId,
    });
    if (eventId) onRefetchEvents?.();
    if (newTodoId && onAddSubtask) {
      for (const s of subtaskEntries) {
        if (s.title.trim()) {
          onAddSubtask(newTodoId, s.title.trim(), {
            due_date: s.due_date || null,
            start_time: s.start_time || null,
          });
        }
      }
    }

    setTitle("");
    setSelectedTagIds([]);
    setDueDate("");
    setStartDate("");
    setStartTime("");
    setEndTime("");
    setPriority("none");
    setNotes("");
    setListId(activeListId ?? null);
    setEventId(null);
    setSubtaskEntries([]);
    setShowOptions(false);
    setShowSuggestions(false);
    setShowCustomDate(false);
    setShowCustomStart(false);
    inputRef.current?.focus();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  function setQuickDate(val: string) {
    setDueDate(val);
    setShowCustomDate(false);
    if (!val) { setStartTime(""); setEndTime(""); }
  }

  const isQuickDate = QUICK_DATES.some((q) => q.fn() === dueDate);
  const isCustomDate = dueDate && !isQuickDate;

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
            placeholder="Add a task... (try: Buy milk tomorrow at 3pm !high #Work @Meeting)"
            className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
            aria-label="New task title"
          />
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

        {/* Autocomplete suggestions */}
        {!showOptions && showSuggestions && suggestions.length > 0 && (
          <div className="mt-1.5 glass-card-raised rounded-xl overflow-hidden">
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
                <span className="text-xs text-gray-400 ml-auto">Tab ↹</span>
              </button>
            ))}
          </div>
        )}

        {/* NL live preview */}
        {!showOptions && (parsed || listId || eventId) && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 mr-0.5 font-medium">
              Parsed:
            </span>
            {parsed?.title && parsed.title !== title.trim() && (
              <span className="text-xs text-black dark:text-white font-medium bg-black/[0.04] dark:bg-white/[0.08] px-2 py-0.5 rounded-md border border-black/5 dark:border-white/10 truncate max-w-[200px]">
                &ldquo;{parsed.title}&rdquo;
              </span>
            )}
            {parsed?.due_date && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40">
                <Calendar size={10} />
                {formatDateLabel(parsed.due_date)}
              </span>
            )}
            {parsed?.start_time && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/40">
                <Clock size={10} />
                {formatTimeLabel(parsed.start_time)}
              </span>
            )}
            {parsed?.priority && parsed.priority !== "none" && (
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${PRIORITY_COLORS[parsed.priority]}`}>
                {parsed.priority.charAt(0).toUpperCase() + parsed.priority.slice(1)}
              </span>
            )}
            {parsed?.tagNames?.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/40">
                <Hash size={10} />
                {name}
              </span>
            ))}
            {listId && lists.find((l) => l.id === listId) && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40">
                <ListIcon size={10} />
                {lists.find((l) => l.id === listId)!.name}
                <button type="button" onClick={() => setListId(activeListId ?? null)} className="ml-0.5 opacity-60 hover:opacity-100">
                  <X size={9} />
                </button>
              </span>
            )}
            {eventId && events.find((e) => e.id === eventId) && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/40">
                <CalendarRange size={10} />
                {events.find((e) => e.id === eventId)!.title}
                <button type="button" onClick={() => setEventId(null)} className="ml-0.5 opacity-60 hover:opacity-100">
                  <X size={9} />
                </button>
              </span>
            )}
          </div>
        )}

        {/* ── Expanded options ── */}
        {showOptions && (
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-3">

            {/* Priority */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-14 flex-shrink-0">Priority</span>
              <div className="flex gap-1.5">
                {PRIORITY_CONFIG.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-default ${
                      priority === p.value
                        ? p.active + " font-medium"
                        : "border-black/8 dark:border-white/8 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/15 dark:hover:border-white/15"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-400 w-14 flex-shrink-0 pt-0.5">Due</span>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DATES.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setQuickDate(q.fn())}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                        dueDate === q.fn()
                          ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                          : "border-black/8 dark:border-white/8 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/15 dark:hover:border-white/15"
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}

                  {/* Custom date chip */}
                  {isCustomDate ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium">
                      <Calendar size={10} />
                      {formatDateLabel(dueDate)}
                      <button
                        type="button"
                        onClick={() => { setDueDate(""); setStartTime(""); setEndTime(""); }}
                        className="ml-0.5 text-gray-400 hover:text-black dark:hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCustomDate((v) => !v)}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-default ${
                        showCustomDate
                          ? "border-black/20 dark:border-white/20 text-black dark:text-white"
                          : "border-black/8 dark:border-white/8 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/15 dark:hover:border-white/15"
                      }`}
                    >
                      <Calendar size={10} />
                      Custom
                    </button>
                  )}

                  {/* No date */}
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => setQuickDate("")}
                      className="text-xs px-2 py-1 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-default"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Custom date input */}
                {showCustomDate && !isCustomDate && (
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); if (e.target.value) setShowCustomDate(false); }}
                    className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                  />
                )}
              </div>
            </div>

            {/* Time — only if due date set */}
            {dueDate && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-14 flex-shrink-0">Time</span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                  />
                  {startTime && (
                    <>
                      <span className="text-xs text-gray-400">→</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        placeholder="End"
                        className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Start date */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-400 w-14 flex-shrink-0 pt-0.5">Start</span>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {startDate ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium">
                      <Calendar size={10} />
                      {formatDateLabel(startDate)}
                      <button
                        type="button"
                        onClick={() => setStartDate("")}
                        className="ml-0.5 text-gray-400 hover:text-black dark:hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCustomStart((v) => !v)}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-default ${
                        showCustomStart
                          ? "border-black/20 dark:border-white/20 text-black dark:text-white"
                          : "border-black/8 dark:border-white/8 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/15 dark:hover:border-white/15"
                      }`}
                    >
                      <Calendar size={10} />
                      Set start date
                    </button>
                  )}
                </div>
                {showCustomStart && !startDate && (
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); if (e.target.value) setShowCustomStart(false); }}
                    className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default"
                  />
                )}
                <p className="text-[10px] text-gray-300 dark:text-gray-600">when to begin working on this</p>
              </div>
            </div>

            {/* Notes */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-400 w-14 flex-shrink-0 pt-2">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note..."
                rows={2}
                className="flex-1 text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/30 dark:focus:border-white/30 resize-none transition-default"
              />
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-400 w-14 flex-shrink-0 pt-0.5">Tags</span>
                <div className="flex flex-wrap gap-1.5">
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

            {/* List */}
            {lists.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-14 flex-shrink-0">List</span>
                <select
                  value={listId ?? ""}
                  onChange={(e) => setListId(e.target.value || null)}
                  className="text-xs bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default cursor-pointer"
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

            {/* Event */}
            {events.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-14 flex-shrink-0">Event</span>
                <select
                  value={eventId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setEventId(id);
                    if (id) {
                      const ev = events.find((x) => x.id === id);
                      if (ev?.list_id) setListId(ev.list_id);
                    }
                  }}
                  className="text-xs bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default cursor-pointer"
                >
                  <option value="">No event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Subtasks */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-400 w-14 flex-shrink-0 pt-0.5">Subtasks</span>
              <div className="flex-1 space-y-1.5">
                {subtaskEntries.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                    <input
                      type="text"
                      value={s.title}
                      onChange={(e) => setSubtaskEntries((prev) => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      placeholder="Subtask title"
                      className="flex-1 text-xs bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0"
                    />
                    <input
                      type="date"
                      value={s.due_date}
                      onChange={(e) => setSubtaskEntries((prev) => prev.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))}
                      className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default w-[118px] flex-shrink-0"
                    />
                    {s.due_date && (
                      <input
                        type="time"
                        value={s.start_time}
                        onChange={(e) => setSubtaskEntries((prev) => prev.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))}
                        className="text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-default flex-shrink-0"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setSubtaskEntries((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-default flex-shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSubtaskEntries((prev) => [...prev, { id: crypto.randomUUID(), title: "", due_date: "", start_time: "" }])}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  <Plus size={11} />
                  Add subtask
                </button>
              </div>
            </div>

          </div>
        )}
      </form>
    </div>
  );
}
