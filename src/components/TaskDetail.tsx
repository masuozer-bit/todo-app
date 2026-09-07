"use client";

import { X, Inbox } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { formatRelativeDate, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import type { List as ListType, Todo } from "@/lib/types";

/**
 * Column 3. Phase 2 gives it a head, the properties that need no picker and
 * an empty state; phase 5 moves the full editor here from the task drawer.
 */
export default function TaskDetail({
  todo,
  lists,
  onClose,
  onToggle,
}: {
  todo: Todo | null;
  lists: ListType[];
  onClose: () => void;
  onToggle: (todo: Todo) => void;
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

        {todo.notes && (
          <div className="mt-6">
            <p className="section-title mb-2">{t("Notes")}</p>
            <p className="text-sm text-text-muted whitespace-pre-wrap">{todo.notes}</p>
          </div>
        )}
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
