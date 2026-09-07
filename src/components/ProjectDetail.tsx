"use client";

import { useEffect, useRef, useState } from "react";
import { Inbox, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "./I18nProvider";
import TaskRow from "./TaskRow";
import DateTimePopover from "./ui/DateTimePopover";
import { ListPopover } from "./ui/ChoicePopovers";
import { formatShortDate } from "@/lib/format";
import type { Event, List as ListType, Priority, Todo } from "@/lib/types";

const NOTES_DEBOUNCE = 2000;

export interface EventUpdates {
  title?: string;
  description?: string | null;
  list_id?: string | null;
  due_date?: string | null;
  end_date?: string | null;
}

/**
 * Column 3 for the projects view. What the full-screen project page used to
 * show, in the panel: period, list, description, and the project's tasks.
 */
export default function ProjectDetail({
  event,
  lists,
  onClose,
  onUpdate,
  onDelete,
  onAddTask,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onSelectTodo,
  selectedTodoId,
}: {
  event: Event | null;
  lists: ListType[];
  onClose: () => void;
  onUpdate: (id: string, updates: EventUpdates) => void;
  onDelete: (id: string) => void;
  onAddTask: (eventId: string, title: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onUpdateTodo: (id: string, updates: { title?: string; priority?: Priority; list_id?: string | null }) => void;
  onDeleteTodo: (id: string) => void;
  onSelectTodo?: (id: string) => void;
  selectedTodoId?: string | null;
}) {
  const { t } = useI18n();
  const [draftTask, setDraftTask] = useState("");

  if (!event) {
    return (
      <>
        <div className="app-col-head" />
        <div className="app-col-body flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Inbox size={24} className="text-text-faint" />
          <p className="text-sm text-text-muted">{t("No project selected")}</p>
        </div>
      </>
    );
  }

  const todos = event.todos ?? [];
  const done = todos.filter((x) => x.completed).length;
  const list = event.list_id ? lists.find((l) => l.id === event.list_id) ?? null : null;

  function addTask() {
    if (!event) return;
    const title = draftTask.trim();
    if (!title) return;
    onAddTask(event.id, title);
    setDraftTask("");
  }

  return (
    <>
      <div className="app-col-head">
        <TitleField event={event} onRename={(title) => onUpdate(event.id, { title })} />
        <button onClick={onClose} className="icon-btn flex-none" aria-label={t("Close")}>
          <X size={16} />
        </button>
      </div>

      <div className="app-col-body p-4">
        <div className="props">
          <div className="prop-label">{t("From")}</div>
          <div className="prop-value">
            <DateTimePopover
              date={event.due_date ?? null}
              withTime={false}
              onChange={(date) => onUpdate(event.id, { due_date: date })}
              trigger={(p) => (
                <button ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="prop-button">
                  {event.due_date ? formatShortDate(event.due_date) : <span className="text-text-faint">{t("No date")}</span>}
                </button>
              )}
            />
          </div>
          <div className="prop-label">{t("Until")}</div>
          <div className="prop-value">
            <DateTimePopover
              date={event.end_date ?? null}
              withTime={false}
              onChange={(date) => onUpdate(event.id, { end_date: date })}
              trigger={(p) => (
                <button ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="prop-button">
                  {event.end_date ? formatShortDate(event.end_date) : <span className="text-text-faint">{t("No date")}</span>}
                </button>
              )}
            />
          </div>
          <div className="prop-label">{t("List")}</div>
          <div className="prop-value">
            <ListPopover
              lists={lists}
              onChange={(listId) => onUpdate(event.id, { list_id: listId })}
              trigger={(p) => (
                <button ref={p.ref as (el: HTMLButtonElement | null) => void} onClick={p.onClick} aria-expanded={p["aria-expanded"]} className="prop-button">
                  {list ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-none" style={{ background: list.color ?? "var(--text-faint)" }} />
                      {list.name}
                    </span>
                  ) : (
                    <span className="text-text-faint">{t("No list")}</span>
                  )}
                </button>
              )}
            />
          </div>
        </div>

        <Description event={event} onSave={(id, value) => onUpdate(id, { description: value.trim() === "" ? null : value })} />

        <p className="section-title mt-6 mb-1">
          {t("Tasks")} {todos.length > 0 && `${done}/${todos.length}`}
        </p>
        <div className="-mx-4">
          {todos.map((todo) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              lists={lists}
              hideList
              selected={selectedTodoId === todo.id}
              onSelect={(id) => onSelectTodo?.(id)}
              onToggle={onToggleTodo}
              onRename={(id, title) => onUpdateTodo(id, { title })}
              onDelete={onDeleteTodo}
              onSetPriority={(id, priority) => onUpdateTodo(id, { priority })}
              onSetList={(id, listId) => onUpdateTodo(id, { list_id: listId })}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 h-10 mt-1">
          <Plus size={16} className="flex-none text-text-faint" />
          <input
            value={draftTask}
            onChange={(e) => setDraftTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTask(); }
              if (e.key === "Escape") { e.preventDefault(); setDraftTask(""); }
            }}
            onBlur={addTask}
            placeholder={t("Add task to project")}
            aria-label={t("Add task to project")}
            className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-none flex items-center gap-2 px-4 py-3 border-t border-border">
        <span className="text-xs text-text-faint flex-1 min-w-0 truncate">
          {t("Created {date}", { date: formatShortDate(event.created_at.slice(0, 10)) })}
        </span>
        <button onClick={() => onDelete(event.id)} className="btn btn-text-danger">
          <Trash2 size={14} />
          {t("Delete")}
        </button>
      </div>
    </>
  );
}

function TitleField({ event, onRename }: { event: Event; onRename: (title: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(event.title);
  const ref = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(event.id);

  useEffect(() => {
    if (idRef.current !== event.id || document.activeElement !== ref.current) {
      idRef.current = event.id;
      setDraft(event.title);
    }
  }, [event.id, event.title]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  function commit() {
    const next = draft.trim();
    if (next && next !== event.title) onRename(next);
    else setDraft(event.title);
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); ref.current?.blur(); }
        if (e.key === "Escape") { e.preventDefault(); setDraft(event.title); ref.current?.blur(); }
      }}
      aria-label={t("Project name")}
      className="detail-title"
    />
  );
}

function Description({ event, onSave }: { event: Event; onSave: (id: string, value: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(event.description ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(event.id);

  useEffect(() => {
    if (idRef.current !== event.id) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      idRef.current = event.id;
      setDraft(event.description ?? "");
      return;
    }
    if (!timer.current) setDraft(event.description ?? "");
  }, [event.id, event.description]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="mt-6">
      <p className="section-title mb-2">{t("Description")}</p>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const id = event.id;
          const value = e.target.value;
          timer.current = setTimeout(() => { timer.current = null; onSave(id, value); }, NOTES_DEBOUNCE);
        }}
        onBlur={() => {
          if (timer.current) { clearTimeout(timer.current); timer.current = null; }
          if (draft !== (event.description ?? "")) onSave(event.id, draft);
        }}
        placeholder={t("Add a description...")}
        aria-label={t("Description")}
        className="w-full min-h-[80px] bg-transparent text-sm leading-relaxed text-text placeholder:text-text-faint resize-none focus:outline-none"
      />
    </div>
  );
}
