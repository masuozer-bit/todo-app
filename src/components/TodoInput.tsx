"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useI18n } from "./I18nProvider";
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
import { CustomSelect, DatePicker, TimePicker } from "./Pickers";
import {
  getToday,
  getTomorrow,
  getNextMonday,
  getNextWeek,
  parseNaturalLanguage,
  type ParsedTask,
} from "@/lib/date-helpers";
import TagPill from "./TagPill";
import { formatTime, formatLocale } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";

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
  /** Create a tag that does not exist yet (used for unknown #tags) */
  onCreateTag?: (name: string) => Promise<Tag | undefined>;
  tags: Tag[];
  lists?: List[];
  events?: Event[];
  activeListId?: string | null;
}

type SubtaskEntry = { id: string; title: string; due_date: string; start_time: string };

const PRIORITY_CONFIG: { value: Priority; label: string; dot: string }[] = [
  { value: "none",   label: PRIORITY_META.none.label,   dot: PRIORITY_META.none.dot },
  { value: "low",    label: PRIORITY_META.low.label,    dot: PRIORITY_META.low.dot },
  { value: "medium", label: PRIORITY_META.medium.label, dot: PRIORITY_META.medium.dot },
  { value: "high",   label: PRIORITY_META.high.label,   dot: PRIORITY_META.high.dot },
];


interface Suggestion {
  trigger: string;
  display: string;
  insert: string;
  kind?: "tag" | "list" | "event" | "new-tag" | "date" | "priority" | "time";
  listId?: string;
  eventId?: string;
  tagName?: string;
}

/* One rule everywhere: # is a tag, @ is a list or an event */
function buildSuggestions(
  input: string,
  tags: Tag[],
  lists: List[],
  events: Event[]
): Suggestion[] {
  if (!input.trim()) return [];
  const words = input.split(/\s+/);
  const raw = words[words.length - 1];
  const lastWord = raw.toLowerCase();
  if (!lastWord) return [];

  const suggestions: Suggestion[] = [];

  // #Tag
  if (lastWord.startsWith("#")) {
    const partial = raw.slice(1);
    const partialLower = partial.toLowerCase();
    for (const tag of tags) {
      if (partial === "" || tag.name.toLowerCase().startsWith(partialLower)) {
        suggestions.push({
          trigger: raw,
          display: `#${tag.name}`,
          insert: `#${tag.name}`,
          kind: "tag",
          tagName: tag.name,
        });
      }
    }
    const exact = tags.some((t) => t.name.toLowerCase() === partialLower);
    if (partial && !exact) {
      suggestions.unshift({
        trigger: raw,
        display: `New tag "${partial}"`,
        insert: `#${partial}`,
        kind: "new-tag",
        tagName: partial,
      });
    }
    return suggestions.slice(0, 6);
  }

  // @List or @Event
  if (lastWord.startsWith("@")) {
    const partial = lastWord.slice(1);
    for (const list of lists) {
      if (partial === "" || list.name.toLowerCase().startsWith(partial)) {
        suggestions.push({
          trigger: raw,
          display: list.name,
          insert: "",
          kind: "list",
          listId: list.id,
        });
      }
    }
    for (const ev of events) {
      if (partial === "" || ev.title.toLowerCase().startsWith(partial)) {
        suggestions.push({
          trigger: raw,
          display: ev.title,
          insert: "",
          kind: "event",
          eventId: ev.id,
        });
      }
    }
    return suggestions.slice(0, 6);
  }

  if ("today".startsWith(lastWord) && lastWord.length >= 2 && lastWord !== "today")
    suggestions.push({ trigger: raw, display: "today", insert: "today", kind: "date" });
  if ("tomorrow".startsWith(lastWord) && lastWord.length >= 2 && lastWord !== "tomorrow")
    suggestions.push({ trigger: raw, display: "tomorrow", insert: "tomorrow", kind: "date" });
  if (lastWord === "next") {
    suggestions.push(
      { trigger: raw, display: "next monday", insert: "next monday", kind: "date" },
      { trigger: raw, display: "next week", insert: "next week", kind: "date" }
    );
  }
  if (lastWord === "!" || lastWord === "!h" || lastWord === "!hi")
    suggestions.push({ trigger: raw, display: "!high", insert: "!high", kind: "priority" });
  if (lastWord === "!" || lastWord === "!m" || lastWord === "!me")
    suggestions.push({ trigger: raw, display: "!medium", insert: "!medium", kind: "priority" });
  if (lastWord === "!" || lastWord === "!l" || lastWord === "!lo")
    suggestions.push({ trigger: raw, display: "!low", insert: "!low", kind: "priority" });

  if (lastWord === "at") {
    suggestions.push(
      { trigger: raw, display: "at 9am", insert: "at 9am", kind: "time" },
      { trigger: raw, display: "at 3pm", insert: "at 3pm", kind: "time" },
      { trigger: raw, display: "at 6pm", insert: "at 6pm", kind: "time" }
    );
  }

  return suggestions.slice(0, 6);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Resolve "@Name" in the typed text to a list or an event and take it out of
   the title. Unknown names are left alone rather than silently dropped. */
function resolveMentions(
  text: string,
  lists: List[],
  events: Event[]
): { text: string; listId: string | null; eventId: string | null } {
  if (!text.includes("@")) return { text, listId: null, eventId: null };

  const candidates: { name: string; listId?: string; eventId?: string }[] = [
    ...lists.map((l) => ({ name: l.name, listId: l.id })),
    ...events.map((e) => ({ name: e.title, eventId: e.id })),
  ].sort((a, b) => b.name.length - a.name.length);

  let out = text;
  let listId: string | null = null;
  let eventId: string | null = null;

  for (const candidate of candidates) {
    if (candidate.listId && listId) continue;
    if (candidate.eventId && eventId) continue;
    const re = new RegExp(`@${escapeRegExp(candidate.name)}(?!\\S)`, "i");
    if (!re.test(out)) continue;
    out = out.replace(re, "");
    if (candidate.listId) listId = candidate.listId;
    else eventId = candidate.eventId ?? null;
  }

  return { text: out.replace(/\s+/g, " ").trim(), listId, eventId };
}

function formatDateLabel(dateStr: string): string {
  const today = getToday();
  const tomorrow = getTomorrow();
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(formatLocale(), { day: "numeric", month: "short" });
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
  onCreateTag,
  tags,
  lists = [],
  events = [],
  activeListId,
}: TodoInputProps) {
  const { t } = useI18n();
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

  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setListId(activeListId ?? null); }, [activeListId]);


  // The parser runs whether or not the options panel is open — form fields
  // simply take precedence over what the text says
  const parsed: ParsedTask | null = useMemo(() => {
    if (!title.trim()) return null;
    const p = parseNaturalLanguage(title);
    if (
      p.due_date ||
      p.start_time ||
      p.end_time ||
      (p.priority && p.priority !== "none") ||
      (p.tagNames && p.tagNames.length > 0)
    ) return p;
    return null;
  }, [title]);

  const suggestions = useMemo(() => {
    if (!title.trim()) return [];
    return buildSuggestions(title, tags, lists, events);
  }, [title, tags, lists, events]);

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
      // Only fill in the event's list when none was chosen
      const ev = events.find((x) => x.id === suggestion.eventId);
      if (ev?.list_id && !listId) setListId(ev.list_id);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestion]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShowSuggestions(false);
        return;
      }
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

  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    // A second Enter before the insert returns must not create a duplicate
    if (submittingRef.current) return;
    submittingRef.current = true;

    // @List / @Event first, then the natural language parser
    const mentions = resolveMentions(trimmed, lists, events);
    const p = parseNaturalLanguage(mentions.text);

    let finalTitle = p.title || mentions.text || trimmed;
    // Anything set in the form wins over the same thing written in the text
    const finalDueDate = dueDate || p.due_date || null;
    const finalStartDate = startDate || null;
    const finalStartTime = startTime || p.start_time || null;
    const finalEndTime = endTime || p.end_time || null;
    const finalPriority =
      priority !== "none" ? priority : (p.priority && p.priority !== "none" ? p.priority : "none");
    const finalTagIds = [...selectedTagIds];
    const newTagNames: string[] = [];

    for (const name of p.tagNames ?? []) {
      const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (tag) {
        if (!finalTagIds.includes(tag.id)) finalTagIds.push(tag.id);
      } else {
        newTagNames.push(name);
      }
    }

    if (!finalTitle) finalTitle = trimmed;

    const pendingSubtasks = subtaskEntries.filter((s) => s.title.trim());
    const pendingNotes = notes.trim() || null;
    const pendingListId = listId ?? mentions.listId ?? null;
    const pendingEventId = eventId ?? mentions.eventId ?? null;

    // Clear the field before the request returns so typing can continue
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
    inputRef.current?.focus();

    try {
      // Unknown #tags are created instead of being thrown away
      if (newTagNames.length > 0 && onCreateTag) {
        for (const name of newTagNames) {
          const created = await onCreateTag(name);
          if (created && !finalTagIds.includes(created.id)) finalTagIds.push(created.id);
        }
      }

      const newTodoId = await onAdd(finalTitle, finalTagIds, {
        // A time without a date means today
        due_date: finalDueDate || (finalStartTime ? getToday() : null),
        start_date: finalStartDate,
        start_time: finalStartTime,
        end_time: finalEndTime,
        priority: finalPriority,
        notes: pendingNotes,
        list_id: pendingListId,
        event_id: pendingEventId,
      });

      if (newTodoId && onAddSubtask) {
        for (const s of pendingSubtasks) {
          onAddSubtask(newTodoId, s.title.trim(), {
            due_date: s.due_date || null,
            start_time: s.start_time || null,
          });
        }
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  function cyclePriority() {
    const order: Priority[] = ["none", "low", "medium", "high"];
    setPriority((prev) => order[(order.indexOf(prev) + 1) % order.length]);
  }

  function setQuickDate(val: string) {
    setDueDate(val);
    if (!val) { setStartTime(""); setEndTime(""); }
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
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={t("Add a task... (try: Buy milk tomorrow at 3pm !high #errands @Groceries)")}
            className="flex-1 bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none text-base"
            aria-label={t("New task title")}
            data-new-task-input=""
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
            aria-label={t("Add task")}
          >
            <Plus size={18} />
          </button>
        </div>


        {/* Quick row — date, time and priority without opening the panel */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {QUICK_DATES.slice(0, 3).map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setQuickDate(dueDate === q.fn() ? "" : q.fn())}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
                dueDate === q.fn()
                  ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                  : "border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20"
              }`}
            >
              {q.label}
            </button>
          ))}
          <DatePicker value={dueDate} onChange={setDueDate} placeholder={t("Date")} />
          <TimePicker value={startTime} onChange={setStartTime} placeholder={t("Time")} />
          {startTime && (
            <>
              <span className="text-xs text-gray-400">→</span>
              <TimePicker value={endTime} onChange={setEndTime} placeholder={t("End")} />
            </>
          )}
          <button
            type="button"
            onClick={cyclePriority}
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
              priority !== "none"
                ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 text-black dark:text-white font-medium"
                : "border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20"
            }`}
            aria-label={t("Change priority")}
            title={t("Change priority")}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CONFIG.find((p) => p.value === priority)?.dot}`} />
            {PRIORITY_CONFIG.find((p) => p.value === priority)?.label ?? "None"}
          </button>
          {(dueDate || startTime || priority !== "none") && (
            <button
              type="button"
              onClick={() => { setDueDate(""); setStartTime(""); setEndTime(""); setPriority("none"); }}
              className="text-gray-400 hover:text-black dark:hover:text-white transition-default"
              aria-label={t("Clear date, time and priority")}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
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
                {s.kind === "list" && <span className="text-[11px] uppercase tracking-wide text-gray-400">{t("List")}</span>}
                {s.kind === "event" && <span className="text-[11px] uppercase tracking-wide text-gray-400">{t("Project")}</span>}
                {s.kind === "tag" && <span className="text-[11px] uppercase tracking-wide text-gray-400">{t("Tag")}</span>}
                {s.kind === "new-tag" && <span className="text-[11px] uppercase tracking-wide text-gray-400">{t("New")}</span>}
                <span className="text-xs text-gray-400 ml-auto">↵</span>
              </button>
            ))}
          </div>
        )}

        {/* NL live preview */}
        {(parsed || listId || eventId) && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 mr-0.5 font-medium">{t("Parsed:")}</span>
            {parsed?.title && parsed.title !== title.trim() && (
              <span className="text-xs text-black dark:text-white font-medium bg-black/[0.04] dark:bg-white/[0.08] px-2 py-0.5 rounded-md border border-black/5 dark:border-white/10 truncate max-w-[200px]">
                &ldquo;{parsed.title}&rdquo;
              </span>
            )}
            {parsed?.due_date && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-black/60 dark:text-gray-300">
                <Calendar size={10} />
                {formatDateLabel(parsed.due_date)}
              </span>
            )}
            {parsed?.start_time && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-black/60 dark:text-gray-300">
                <Clock size={10} />
                {formatTime(parsed.start_time)}
              </span>
            )}
            {parsed?.priority && parsed.priority !== "none" && (() => {
              const pc = PRIORITY_CONFIG.find(p => p.value === parsed.priority);
              return (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-black/60 dark:text-gray-300">
                  {pc && <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />}
                  {parsed.priority.charAt(0).toUpperCase() + parsed.priority.slice(1)}
                </span>
              );
            })()}
            {parsed?.tagNames?.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-black/60 dark:text-gray-300">
                <Hash size={10} />
                {name}
              </span>
            ))}
            {listId && lists.find((l) => l.id === listId) && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-black/60 dark:text-gray-300">
                <ListIcon size={10} />
                {lists.find((l) => l.id === listId)!.name}
                <button type="button" onClick={() => setListId(activeListId ?? null)} className="ml-0.5 opacity-60 hover:opacity-100">
                  <X size={9} />
                </button>
              </span>
            )}
            {eventId && events.find((e) => e.id === eventId) && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-black/60 dark:text-gray-300">
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
          <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-4">

            {/* ① Start date */}
            <div className="flex items-center gap-2">
              <CalendarRange size={11} className="text-gray-400 flex-shrink-0" />
              {startDate ? (
                <span className="inline-flex items-center gap-1 text-xs text-black/60 dark:text-gray-400">
                  Start {formatDateLabel(startDate)}
                  <button type="button" onClick={() => setStartDate("")} className="text-gray-400 hover:text-black dark:hover:text-white ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ) : (
                <DatePicker value={startDate} onChange={setStartDate} placeholder={t("Start date")} />
              )}
            </div>

            {/* ② Tags */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t("Tags")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <TagPill
                      key={tag.id}
                      name={tag.name}
                      size="sm"
                      selected={selectedTagIds.includes(tag.id)}
                      onClick={() => toggleTag(tag.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ③ List + Event */}
            {(lists.length > 0 || events.length > 0) && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t("Assign to")}</p>
                <div className="flex flex-wrap gap-2">
                  {lists.length > 0 && (
                    <CustomSelect
                      value={listId ?? ""}
                      onChange={(v) => setListId(v || null)}
                      options={[{ value: "", label: "No list" }, ...lists.map((l) => ({ value: l.id, label: l.name, color: l.color ?? undefined }))]}
                      className="min-w-[110px]"
                    />
                  )}
                  {events.length > 0 && (
                    <CustomSelect
                      value={eventId ?? ""}
                      onChange={(id) => {
                        setEventId(id || null);
                        if (id && !listId) {
                          const ev = events.find((x) => x.id === id);
                          if (ev?.list_id) setListId(ev.list_id);
                        }
                      }}
                      options={[{ value: "", label: "No project" }, ...events.map((ev) => ({ value: ev.id, label: ev.title }))]}
                      className="min-w-[110px]"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ④ Notes */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("Add a note...")}
              rows={2}
              className="w-full text-sm bg-transparent border border-black/8 dark:border-white/8 rounded-xl px-3 py-2 text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black/20 dark:focus:border-white/20 resize-none transition-default"
            />

            {/* ⑤ Subtasks */}
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">{t("Subtasks")}</p>
              <div className="space-y-1.5">
                {subtaskEntries.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 group/sub">
                    <span className="w-1.5 h-1.5 rounded-full bg-black/15 dark:bg-white/20 flex-shrink-0" />
                    <input
                      type="text"
                      value={s.title}
                      onChange={(e) => setSubtaskEntries((prev) => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      placeholder={`Subtask ${i + 1}...`}
                      className="flex-1 text-sm bg-transparent text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => setSubtaskEntries((prev) => prev.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover/sub:opacity-100 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-default flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSubtaskEntries((prev) => [...prev, { id: crypto.randomUUID(), title: "", due_date: "", start_time: "" }])}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default"
                >
                  <Plus size={11} />{t("Add subtask")}</button>
              </div>
            </div>

          </div>
        )}
      </form>
    </div>
  );
}
