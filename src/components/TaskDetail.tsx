"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Inbox, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { formatRelativeDate, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import type { List as ListType, Todo } from "@/lib/types";

const NOTES_DEBOUNCE = 2000;

/**
 * Column 3. Phase 2 gives it a head, the properties that need no picker and
 * an empty state; phase 5 moves the full editor here from the task drawer.
 */
export default function TaskDetail({
  todo,
  lists,
  onClose,
  onToggle,
  onSaveNotes,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: {
  todo: Todo | null;
  lists: ListType[];
  onClose: () => void;
  onToggle: (todo: Todo) => void;
  onSaveNotes?: (id: string, notes: string) => void;
  onAddSubtask?: (todoId: string, title: string) => void;
  onToggleSubtask?: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask?: (todoId: string, subtaskId: string) => void;
}) {
  const { t } = useI18n();

  if (!todo) return <TaskDetailEmpty />;

  const list = todo.list_id ? lists.find((l) => l.id === todo.list_id) ?? null : null;
  const due = todo.due_date
    ? `${formatRelativeDate(todo.due_date)}${todo.start_time ? ` ${formatTime(todo.start_time)}` : ""}`
    : null;

  return (
    <>
      <div className="app-col-head">
        <button
          onClick={() => onToggle(todo)}
          aria-label={todo.completed ? t("Mark as not done") : t("Mark as done")}
          className="w-[18px] h-[18px] rounded-full flex-none flex items-center justify-center"
          style={{
            border: `1px solid ${todo.completed ? "var(--accent)" : "var(--border-strong)"}`,
            background: todo.completed ? "var(--accent)" : "transparent",
          }}
        >
          {todo.completed && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </button>
        <h2 className="flex-1 min-w-0 truncate text-base font-medium text-text">{todo.title}</h2>
        <button onClick={onClose} className="icon-btn flex-none" aria-label={t("Close")}>
          <X size={16} />
        </button>
      </div>

      <div className="app-col-body p-4">
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-y-1">
          <Prop label={t("Due")}>
            {due ?? <span className="text-text-faint">{t("No date")}</span>}
          </Prop>
          <Prop label={t("Priority")}>
            {PRIORITY_META[todo.priority].bar === null ? (
              <span className="text-text-faint">{t("None")}</span>
            ) : (
              <span className="flex items-center gap-2">
                <span
                  className="w-[3px] h-4 rounded-full flex-none"
                  style={{ background: PRIORITY_META[todo.priority].bar as string }}
                />
                {t(PRIORITY_META[todo.priority].label)}
              </span>
            )}
          </Prop>
          <Prop label={t("List")}>
            {list ? (
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-none"
                  style={{ background: list.color ?? "var(--text-faint)" }}
                />
                {list.name}
              </span>
            ) : (
              <span className="text-text-faint">{t("No list")}</span>
            )}
          </Prop>
        </dl>

        {onToggleSubtask && (
          <Subtasks
            todo={todo}
            onAdd={onAddSubtask}
            onToggle={onToggleSubtask}
            onDelete={onDeleteSubtask}
          />
        )}

        {onSaveNotes ? (
          <Notes todo={todo} onSave={onSaveNotes} />
        ) : todo.notes ? (
          <div className="mt-6">
            <p className="section-title mb-2">{t("Notes")}</p>
            <p className="text-sm text-text-muted whitespace-pre-wrap">{todo.notes}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[13px] text-text-muted">{label}</dt>
      <dd className="text-sm text-text h-8 flex items-center min-w-0">{children}</dd>
    </>
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

/** Subtasks as small rows, with a field that keeps focus after Enter. */
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
          <span
            className={`flex-1 min-w-0 truncate text-[13px] ${subtask.completed ? "line-through text-text-faint" : "text-text"}`}
          >
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

  // Switching task drops the pending write of the task being left
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
