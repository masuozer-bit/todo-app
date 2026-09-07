"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Flag, List as ListIcon, Plus } from "lucide-react";
import { useI18n } from "./I18nProvider";
import DateTimePopover from "./ui/DateTimePopover";
import { ListDot, ListPopover, PriorityMark, PriorityPopover } from "./ui/ChoicePopovers";
import { formatRowDate, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import { getToday, parseNaturalLanguage, type ParsedTask } from "@/lib/date-helpers";
import type { Event, List, Priority, Tag } from "@/lib/types";

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
  /** Create a tag that does not exist yet, for an unknown #tag */
  onCreateTag?: (name: string) => Promise<Tag | undefined>;
  tags: Tag[];
  lists?: List[];
  events?: Event[];
  activeListId?: string | null;
  placeholder?: string;
}

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


/**
 * One line. What the text says becomes chips on the right, and each chip
 * opens the picker that set it. Nothing folds out; the three icon buttons
 * appear once the field has focus or text.
 */
export default function TodoInput({
  onAdd,
  onCreateTag,
  tags,
  lists = [],
  events = [],
  activeListId,
  placeholder,
}: TodoInputProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("none");
  const [listId, setListId] = useState<string | null>(activeListId ?? null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => { setListId(activeListId ?? null); }, [activeListId]);

  // The parser reads the text; a picker set by hand wins over it
  const parsed: ParsedTask | null = useMemo(() => {
    if (!title.trim()) return null;
    const p = parseNaturalLanguage(title);
    const meaningful =
      p.due_date || p.start_time || p.end_time ||
      (p.priority && p.priority !== "none") ||
      (p.tagNames && p.tagNames.length > 0);
    return meaningful ? p : null;
  }, [title]);

  const suggestions = useMemo(
    () => (title.trim() ? buildSuggestions(title, tags, lists, events) : []),
    [title, tags, lists, events]
  );

  useEffect(() => {
    setSelectedSuggestion(0);
    setShowSuggestions(suggestions.length > 0);
  }, [suggestions]);

  const shownDate = dueDate ?? parsed?.due_date ?? null;
  const shownTime = startTime ?? parsed?.start_time ?? null;
  const shownPriority: Priority = priority !== "none" ? priority : (parsed?.priority ?? "none");
  const shownList = listId ? lists.find((l) => l.id === listId) ?? null : null;
  const shownTags = parsed?.tagNames ?? [];
  const hasContent = title.trim().length > 0;

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
      const event = events.find((x) => x.id === suggestion.eventId);
      if (event?.list_id && !listId) setListId(event.list_id);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowRight") {
      e.preventDefault();
      applySuggestion(suggestions[selectedSuggestion]);
      return;
    }
    if (e.key === "Escape") {
      // Only the popover closes; the text stays
      e.preventDefault();
      e.stopPropagation();
      setShowSuggestions(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestion((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestion((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    }
  }

  function reset() {
    setTitle("");
    setDueDate(null);
    setStartTime(null);
    setPriority("none");
    setListId(activeListId ?? null);
    setEventId(null);
    setShowSuggestions(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    // A second Enter before the insert returns must not create a duplicate
    if (submittingRef.current) return;
    submittingRef.current = true;

    // @List and @Project first, then the natural language parser
    const mentions = resolveMentions(trimmed, lists, events);
    const p = parseNaturalLanguage(mentions.text);

    const finalTitle = p.title || mentions.text || trimmed;
    const finalDueDate = dueDate ?? p.due_date ?? null;
    const finalStartTime = startTime ?? p.start_time ?? null;
    const finalEndTime = p.end_time ?? null;
    const finalPriority: Priority =
      priority !== "none" ? priority : (p.priority && p.priority !== "none" ? p.priority : "none");

    const finalTagIds: string[] = [];
    const newTagNames: string[] = [];
    for (const name of p.tagNames ?? []) {
      const tag = tags.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (tag) { if (!finalTagIds.includes(tag.id)) finalTagIds.push(tag.id); }
      else newTagNames.push(name);
    }

    const pendingListId = listId ?? mentions.listId ?? null;
    const pendingEventId = eventId ?? mentions.eventId ?? null;

    // Clear before the request returns, so typing can carry on
    reset();
    inputRef.current?.focus();

    try {
      // An unknown #tag is created instead of being thrown away
      if (newTagNames.length > 0 && onCreateTag) {
        for (const name of newTagNames) {
          const created = await onCreateTag(name);
          if (created && !finalTagIds.includes(created.id)) finalTagIds.push(created.id);
        }
      }

      await onAdd(finalTitle, finalTagIds, {
        // A time without a date means today
        due_date: finalDueDate || (finalStartTime ? getToday() : null),
        start_date: null,
        start_time: finalStartTime,
        end_time: finalEndTime,
        priority: finalPriority,
        notes: null,
        list_id: pendingListId,
        event_id: pendingEventId,
      });

    } finally {
      submittingRef.current = false;
    }
  }

  const showButtons = focused || hasContent;

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="quick-input">
        <Plus size={16} className="flex-none text-text-faint" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); if (suggestions.length > 0) setShowSuggestions(true); }}
          onBlur={() => { setFocused(false); setTimeout(() => setShowSuggestions(false), 150); }}
          placeholder={placeholder ?? t("Add a task")}
          aria-label={t("New task title")}
          data-new-task-input=""
          className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
        />

        <span className="flex items-center gap-1 flex-none">
          {shownDate && (
            <DateTimePopover
              date={shownDate}
              time={shownTime}
              align="end"
              onChange={(date, time) => { setDueDate(date); setStartTime(time); }}
              trigger={(p) => (
                <button type="button" ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="chip">
                  {t(formatRowDate(shownDate))}
                </button>
              )}
            />
          )}
          {shownTime && (
            <DateTimePopover
              date={shownDate}
              time={shownTime}
              align="end"
              onChange={(date, time) => { setDueDate(date); setStartTime(time); }}
              trigger={(p) => (
                <button type="button" ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="chip tabular-nums">
                  {formatTime(shownTime)}
                </button>
              )}
            />
          )}
          {shownPriority !== "none" && (
            <PriorityPopover
              value={shownPriority}
              align="end"
              onChange={setPriority}
              trigger={(p) => (
                <button type="button" ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="chip">
                  <span className="w-[3px] h-3 rounded-full" style={{ background: PRIORITY_META[shownPriority].bar as string }} />
                  {t(PRIORITY_META[shownPriority].label)}
                </button>
              )}
            />
          )}
          {shownList && (
            <ListPopover
              lists={lists}
              align="end"
              onChange={setListId}
              trigger={(p) => (
                <button type="button" ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="chip">
                  <span className="w-2 h-2 rounded-full" style={{ background: shownList.color ?? "var(--text-faint)" }} />
                  {shownList.name}
                </button>
              )}
            />
          )}
          {shownTags.map((name) => (
            <span key={name} className="chip">{name}</span>
          ))}
        </span>

        {showButtons && (
          <span className="flex items-center gap-0.5 flex-none">
            <DateTimePopover
              date={shownDate}
              time={shownTime}
              align="end"
              onChange={(date, time) => { setDueDate(date); setStartTime(time); }}
              trigger={(p) => (
                <button
                  type="button"
                  ref={p.ref as (el: HTMLButtonElement | null) => void}
                  onClick={p.onClick}
                  aria-expanded={p["aria-expanded"]}
                  onMouseDown={(e) => e.preventDefault()}
                  className="icon-btn w-7 h-7"
                  aria-label={t("Date")}
                  title={t("Date")}
                >
                  <CalendarDays size={16} />
                </button>
              )}
            />
            <PriorityPopover
              value={shownPriority}
              align="end"
              onChange={setPriority}
              trigger={(p) => (
                <button
                  type="button"
                  ref={p.ref as (el: HTMLButtonElement | null) => void}
                  onClick={p.onClick}
                  aria-expanded={p["aria-expanded"]}
                  onMouseDown={(e) => e.preventDefault()}
                  className="icon-btn w-7 h-7"
                  aria-label={t("Priority")}
                  title={t("Priority")}
                >
                  <Flag size={16} />
                </button>
              )}
            />
            <ListPopover
              lists={lists}
              align="end"
              onChange={setListId}
              trigger={(p) => (
                <button
                  type="button"
                  ref={p.ref as (el: HTMLButtonElement | null) => void}
                  onClick={p.onClick}
                  aria-expanded={p["aria-expanded"]}
                  onMouseDown={(e) => e.preventDefault()}
                  className="icon-btn w-7 h-7"
                  aria-label={t("List")}
                  title={t("List")}
                >
                  <ListIcon size={16} />
                </button>
              )}
            />
          </span>
        )}
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <div className="popover absolute left-0 right-0 top-full mt-1 z-40">
          {suggestions.map((s, i) => (
            <button
              key={s.display + i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(s)}
              className={`w-full flex items-center gap-2 h-8 px-2 rounded text-[13px] transition-default ${
                i === selectedSuggestion ? "bg-surface-2 text-text" : "text-text-muted hover:bg-surface-2"
              }`}
            >
              {s.kind === "list" && <ListDot color={lists.find((l) => l.id === s.listId)?.color} />}
              {s.kind === "priority" && <PriorityMark priority="none" />}
              <span className="flex-1 text-left truncate">{s.display}</span>
              <span className="text-xs text-text-faint">{kindLabel(s.kind, t)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function kindLabel(
  kind: Suggestion["kind"],
  t: (key: string) => string
): string {
  switch (kind) {
    case "list": return t("List");
    case "event": return t("Project");
    case "tag": return t("Tag");
    case "new-tag": return t("New");
    case "date": return t("Date");
    case "time": return t("Time");
    case "priority": return t("Priority");
    default: return "";
  }
}
