"use client";

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Inbox,
  LayoutTemplate,
  MoreHorizontal,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import Popover, { PopoverItem } from "@/components/ui/Popover";
import DateTimePopover from "@/components/ui/DateTimePopover";
import { formatRowDate, formatShortDate, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import type { TodoUpdates } from "@/hooks/useTodos";
import type { Event, List as ListType, Priority, Tag, Todo } from "@/lib/types";

const NOTES_DEBOUNCE = 2000;
const ESTIMATE_CHIPS = [15, 30, 60, 120];
const PRIORITIES: Priority[] = ["high", "medium", "low", "none"];

export interface TaskDetailProps {
  todo: Todo | null;
  lists: ListType[];
  events?: Event[];
  allTags?: Tag[];
  onClose: () => void;
  onToggle: (todo: Todo) => void;
  onUpdate: (id: string, updates: TodoUpdates) => void;
  /** Assigning a project can hand the task the project's list, so it has its
      own path rather than going through onUpdate. */
  onAssignProject?: (todoId: string, eventId: string | null) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (todo: Todo) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
  onAddSubtask?: (todoId: string, title: string) => void;
  onToggleSubtask?: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask?: (todoId: string, subtaskId: string) => void;
  onTagToggle?: (todoId: string, tagId: string, add: boolean) => void;
  onCreateTag?: (name: string) => Promise<Tag | undefined>;
  onStartTimer?: (todoId: string) => void;
  liveTaskId?: string | null;
}

/**
 * Column 3. Everything about one task, in place, without an overlay:
 * head, properties, subtasks, notes, and a foot that says when it was made.
 */
export default function TaskDetail(props: TaskDetailProps) {
  if (!props.todo) return <TaskDetailEmpty />;
  return <TaskDetailBody {...props} todo={props.todo} />;
}

function TaskDetailBody({
  todo,
  lists,
  events = [],
  allTags = [],
  onClose,
  onToggle,
  onUpdate,
  onAssignProject,
  onDelete,
  onDuplicate,
  onSaveAsTemplate,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onTagToggle,
  onCreateTag,
  onStartTimer,
  liveTaskId,
}: TaskDetailProps & { todo: Todo }) {
  const { t } = useI18n();
  const list = todo.list_id ? lists.find((l) => l.id === todo.list_id) ?? null : null;
  const event = todo.event_id ? events.find((e) => e.id === todo.event_id) ?? null : null;
  const priority = PRIORITY_META[todo.priority ?? "none"];
  const extraDates = todo.extra_dates ?? [];
  const [showExtraDates, setShowExtraDates] = useState(false);

  return (
    <>
      <div className="app-col-head">
        <button
          onClick={() => onToggle(todo)}
          className="task-circle"
          aria-label={todo.completed ? t("Mark as not done") : t("Mark as done")}
          aria-pressed={todo.completed}
        >
          {todo.completed && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </button>

        <TitleField todo={todo} onRename={(title) => onUpdate(todo.id, { title })} />

        <Popover
          align="end"
          label={t("Task options")}
          trigger={(p) => (
            <button
              ref={p.ref as (el: HTMLButtonElement | null) => void}
              onClick={p.onClick}
              aria-expanded={p["aria-expanded"]}
              className="icon-btn flex-none"
              aria-label={t("Task options")}
            >
              <MoreHorizontal size={16} />
            </button>
          )}
        >
          {(close) => (
            <div className="min-w-[200px]">
              {onDuplicate && (
                <PopoverItem icon={<Copy size={16} />} onClick={() => { close(); onDuplicate(todo); }}>
                  {t("Duplicate")}
                </PopoverItem>
              )}
              {onSaveAsTemplate && (
                <PopoverItem icon={<LayoutTemplate size={16} />} onClick={() => { close(); onSaveAsTemplate(todo); }}>
                  {t("Save as template")}
                </PopoverItem>
              )}
              {onDelete && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <PopoverItem icon={<Trash2 size={16} />} danger onClick={() => { close(); onDelete(todo.id); }}>
                    {t("Delete")}
                  </PopoverItem>
                </>
              )}
            </div>
          )}
        </Popover>

        <button onClick={onClose} className="icon-btn flex-none" aria-label={t("Close")}>
          <X size={16} />
        </button>
      </div>

      <div className="app-col-body p-4">
        <div className="props">
          <Prop label={t("Due")}>
            <DateTimePopover
              date={todo.due_date ?? null}
              time={todo.start_time ?? null}
              onChange={(date, time) => onUpdate(todo.id, { due_date: date, start_time: time })}
              trigger={(p) => (
                <PropButton p={p}>
                  {todo.due_date
                    ? `${t(formatRowDate(todo.due_date))}${todo.start_time ? ` ${formatTime(todo.start_time)}` : ""}`
                    : <Faint>{t("No date")}</Faint>}
                </PropButton>
              )}
            />
          </Prop>

          <Prop label={t("Start")}>
            <DateTimePopover
              date={todo.start_date ?? null}
              withTime={false}
              onChange={(date) => onUpdate(todo.id, { start_date: date })}
              trigger={(p) => (
                <PropButton p={p}>
                  {todo.start_date ? t(formatRowDate(todo.start_date)) : <Faint>{t("No start date")}</Faint>}
                </PropButton>
              )}
            />
          </Prop>

          <Prop label={t("Priority")}>
            <Popover
              label={t("Priority")}
              trigger={(p) => (
                <PropButton p={p}>
                  {priority.bar ? (
                    <span className="flex items-center gap-2">
                      <span className="w-[3px] h-4 rounded-full flex-none" style={{ background: priority.bar }} />
                      {t(priority.label)}
                    </span>
                  ) : <Faint>{t("None")}</Faint>}
                </PropButton>
              )}
            >
              {(close) => (
                <div className="min-w-[160px]">
                  {PRIORITIES.map((p) => (
                    <PopoverItem
                      key={p}
                      icon={
                        PRIORITY_META[p].bar
                          ? <span className="w-[3px] h-4 rounded-full block ml-[6px] mr-[6px]" style={{ background: PRIORITY_META[p].bar as string }} />
                          : <span className="w-4 flex-none" />
                      }
                      onClick={() => { onUpdate(todo.id, { priority: p }); close(); }}
                    >
                      {t(PRIORITY_META[p].label)}
                    </PopoverItem>
                  ))}
                </div>
              )}
            </Popover>
          </Prop>

          <Prop label={t("List")}>
            <Popover
              label={t("List")}
              trigger={(p) => (
                <PropButton p={p}>
                  {list ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-none" style={{ background: list.color ?? "var(--text-faint)" }} />
                      {list.name}
                    </span>
                  ) : <Faint>{t("No list")}</Faint>}
                </PropButton>
              )}
            >
              {(close) => (
                <div className="min-w-[200px]">
                  <PopoverItem icon={<span className="w-4 flex-none" />} onClick={() => { onUpdate(todo.id, { list_id: null }); close(); }}>
                    {t("No list")}
                  </PopoverItem>
                  {lists.map((l) => (
                    <PopoverItem
                      key={l.id}
                      icon={<span className="w-2 h-2 rounded-full block ml-[7px] mr-[7px]" style={{ background: l.color ?? "var(--text-faint)" }} />}
                      onClick={() => { onUpdate(todo.id, { list_id: l.id }); close(); }}
                    >
                      {l.name}
                    </PopoverItem>
                  ))}
                </div>
              )}
            </Popover>
          </Prop>

          {events.length > 0 && onAssignProject && (
            <Prop label={t("Project")}>
              <Popover
                label={t("Project")}
                trigger={(p) => (
                  <PropButton p={p}>
                    {event ? event.title : <Faint>{t("No project")}</Faint>}
                  </PropButton>
                )}
              >
                {(close) => (
                  <div className="min-w-[200px]">
                    <PopoverItem icon={<span className="w-4 flex-none" />} onClick={() => { onAssignProject(todo.id, null); close(); }}>
                      {t("No project")}
                    </PopoverItem>
                    {events.map((e) => (
                      <PopoverItem key={e.id} icon={<span className="w-4 flex-none" />} onClick={() => { onAssignProject(todo.id, e.id); close(); }}>
                        {e.title}
                      </PopoverItem>
                    ))}
                  </div>
                )}
              </Popover>
            </Prop>
          )}

          <Prop label={t("Estimate")}>
            <Estimate todo={todo} onSave={(minutes) => onUpdate(todo.id, { estimated_time: minutes })} />
          </Prop>
        </div>

        {extraDates.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowExtraDates((v) => !v)}
              className="btn btn-ghost h-7 px-2 text-[13px]"
              aria-expanded={showExtraDates}
            >
              {t("More dates")} ({extraDates.length})
            </button>
            {showExtraDates && (
              <ul className="mt-1 pl-2">
                {[...extraDates].sort((a, b) => a.date.localeCompare(b.date)).map((d) => (
                  <li key={d.date} className="flex items-center gap-2 h-7 text-[13px] text-text-muted">
                    <span className={d.completed ? "line-through text-text-faint" : ""}>
                      {formatShortDate(d.date)}{d.time ? ` ${formatTime(d.time)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {onTagToggle && (
          <Tags
            todo={todo}
            allTags={allTags}
            onToggle={onTagToggle}
            onCreate={onCreateTag}
          />
        )}

        {onToggleSubtask && (
          <Subtasks todo={todo} onAdd={onAddSubtask} onToggle={onToggleSubtask} onDelete={onDeleteSubtask} />
        )}

        <Notes todo={todo} onSave={(id, notes) => onUpdate(id, { notes: notes.trim() === "" ? null : notes })} />
      </div>

      <div className="flex-none flex items-center gap-2 px-4 py-3 border-t border-border">
        <span className="text-xs text-text-faint flex-1 min-w-0 truncate">
          {t("Created {date}", { date: formatShortDate(todo.created_at.slice(0, 10)) })}
        </span>
        {onStartTimer && !todo.completed && (
          <button
            onClick={() => onStartTimer(todo.id)}
            className={`btn ${liveTaskId === todo.id ? "btn-primary" : "btn-secondary"}`}
          >
            <Play size={14} />
            {t("Start timer")}
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(todo.id)} className="btn btn-text-danger">
            {t("Delete")}
          </button>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="prop-label">{label}</div>
      <div className="prop-value">{children}</div>
    </>
  );
}

function Faint({ children }: { children: React.ReactNode }) {
  return <span className="text-text-faint">{children}</span>;
}

/** The clickable half of a property row. */
function PropButton({
  p,
  children,
}: {
  p: { ref: (el: HTMLElement | null) => void; onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean };
  children: React.ReactNode;
}) {
  return (
    <button
      ref={p.ref as (el: HTMLButtonElement | null) => void}
      onClick={p.onClick}
      aria-expanded={p["aria-expanded"]}
      className="prop-button"
    >
      {children}
    </button>
  );
}

/** The title grows with its text and only shows a border once it has focus. */
function TitleField({ todo, onRename }: { todo: Todo; onRename: (title: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(todo.title);
  const ref = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(todo.id);

  useEffect(() => {
    if (idRef.current !== todo.id || document.activeElement !== ref.current) {
      idRef.current = todo.id;
      setDraft(todo.title);
    }
  }, [todo.id, todo.title]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  function commit() {
    const next = draft.trim();
    if (next && next !== todo.title) onRename(next);
    else setDraft(todo.title);
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
        if (e.key === "Escape") { e.preventDefault(); setDraft(todo.title); ref.current?.blur(); }
      }}
      aria-label={t("Task title")}
      className="detail-title"
    />
  );
}

function Estimate({ todo, onSave }: { todo: Todo; onSave: (minutes: number | null) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(todo.estimated_time ? String(todo.estimated_time) : "");

  useEffect(() => {
    setDraft(todo.estimated_time ? String(todo.estimated_time) : "");
  }, [todo.estimated_time]);

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Math.max(0, Math.round(Number(trimmed)));
    if (next !== null && Number.isNaN(next)) { setDraft(todo.estimated_time ? String(todo.estimated_time) : ""); return; }
    if (next === (todo.estimated_time ?? null)) return;
    onSave(next);
  }

  return (
    <div className="flex items-center gap-1 h-8">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        inputMode="numeric"
        placeholder={t("min")}
        aria-label={t("Estimate")}
        className="input w-[64px] flex-none text-center tabular-nums"
      />
      {ESTIMATE_CHIPS.map((m) => (
        <button
          key={m}
          onClick={() => { setDraft(String(m)); onSave(m); }}
          className={`chip tabular-nums ${todo.estimated_time === m ? "chip-accent" : ""}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function Tags({
  todo,
  allTags,
  onToggle,
  onCreate,
}: {
  todo: Todo;
  allTags: Tag[];
  onToggle: (todoId: string, tagId: string, add: boolean) => void;
  onCreate?: (name: string) => Promise<Tag | undefined>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const tags = todo.tags ?? [];
  const own = new Set(tags.map((tag) => tag.id));

  async function add(name: string) {
    const clean = name.trim();
    if (!clean) return;
    const existing = allTags.find((tag) => tag.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      if (!own.has(existing.id)) onToggle(todo.id, existing.id, true);
    } else if (onCreate) {
      const created = await onCreate(clean);
      if (created) onToggle(todo.id, created.id, true);
    }
    setDraft("");
  }

  return (
    <div className="mt-6">
      <p className="section-title mb-2">{t("Tags")}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag.id} className="chip">
            {tag.name}
            <button onClick={() => onToggle(todo.id, tag.id, false)} aria-label={t("Remove")}>
              <X size={12} />
            </button>
          </span>
        ))}
        <Popover
          label={t("Add tag")}
          trigger={(p) => (
            <button
              ref={p.ref as (el: HTMLButtonElement | null) => void}
              onClick={p.onClick}
              aria-expanded={p["aria-expanded"]}
              className="chip"
            >
              <Plus size={12} />
              {t("Tag")}
            </button>
          )}
        >
          {(close) => (
            <div className="min-w-[200px]">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); add(draft).then(close); }
                }}
                placeholder={t("New tag")}
                aria-label={t("New tag")}
                className="input mb-1"
              />
              {allTags.filter((tag) => !own.has(tag.id) && tag.name.toLowerCase().includes(draft.trim().toLowerCase())).map((tag) => (
                <PopoverItem key={tag.id} onClick={() => { onToggle(todo.id, tag.id, true); close(); }}>
                  {tag.name}
                </PopoverItem>
              ))}
            </div>
          )}
        </Popover>
      </div>
    </div>
  );
}

function Subtasks({
  todo,
  onAdd,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onAdd?: (todoId: string, title: string) => void;
  onToggle: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDelete?: (todoId: string, subtaskId: string) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const subtasks = todo.subtasks ?? [];
  const done = subtasks.filter((s) => s.completed).length;

  function add() {
    const title = draft.trim();
    if (!title || !onAdd) return;
    onAdd(todo.id, title);
    setDraft("");
  }

  return (
    <div className="mt-6">
      <p className="section-title mb-2">
        {t("Subtasks")}{subtasks.length > 0 && ` ${done}/${subtasks.length}`}
      </p>
      {subtasks.map((subtask) => (
        <div key={subtask.id} className="group flex items-center gap-2 h-8">
          <button
            onClick={() => onToggle(todo.id, subtask.id, !subtask.completed)}
            className="task-circle"
            style={{ width: 16, height: 16 }}
            aria-label={subtask.completed ? t("Mark as not done") : t("Mark as done")}
            aria-pressed={subtask.completed}
          >
            {subtask.completed && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
          <span className={`flex-1 min-w-0 truncate text-[13px] ${subtask.completed ? "line-through text-text-faint" : "text-text"}`}>
            {subtask.title}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(todo.id, subtask.id)}
              className="icon-btn w-6 h-6 flex-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={t("Delete")}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {onAdd && (
        <div className="flex items-center gap-2 h-8">
          <Plus size={16} className="flex-none text-text-faint" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(); }
              if (e.key === "Escape") { e.preventDefault(); setDraft(""); }
            }}
            onBlur={add}
            placeholder={t("Add subtask")}
            aria-label={t("Add subtask")}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

/** Notes save when the field loses focus, and every two seconds while typing. */
function Notes({ todo, onSave }: { todo: Todo; onSave: (id: string, notes: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(todo.notes ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(todo.id);

  useEffect(() => {
    if (idRef.current !== todo.id) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      idRef.current = todo.id;
      setDraft(todo.notes ?? "");
      return;
    }
    if (!timer.current) setDraft(todo.notes ?? "");
  }, [todo.id, todo.notes]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function change(value: string) {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    const id = todo.id;
    timer.current = setTimeout(() => { timer.current = null; onSave(id, value); }, NOTES_DEBOUNCE);
  }

  function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (draft !== (todo.notes ?? "")) onSave(todo.id, draft);
  }

  return (
    <div className="mt-6">
      <p className="section-title mb-2">{t("Notes")}</p>
      <textarea
        value={draft}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
        placeholder={t("Add a note...")}
        aria-label={t("Notes")}
        className="w-full min-h-[120px] bg-transparent text-sm leading-relaxed text-text placeholder:text-text-faint resize-none focus:outline-none"
      />
    </div>
  );
}

/** No task selected: say so, and name the three keys that do something here. */
function TaskDetailEmpty() {
  const { t } = useI18n();
  const keys: [string, string][] = [
    ["N", t("New task")],
    ["Enter", t("Open")],
    ["Space", t("Mark as done")],
  ];

  return (
    <>
      <div className="app-col-head" />
      <div className="app-col-body flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Inbox size={24} className="text-text-faint" />
        <p className="text-sm text-text-muted">{t("No task selected")}</p>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1.5 text-[13px]">
          {keys.map(([key, label]) => (
            <div key={key} className="contents">
              <dt className="text-right">
                <kbd className="px-1.5 py-0.5 rounded surface-2 border border-border text-xs font-mono text-text-muted">
                  {key}
                </kbd>
              </dt>
              <dd className="text-left text-text-faint">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
