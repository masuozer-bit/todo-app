"use client";

import { useI18n } from "./I18nProvider";
import { formatShortDate } from "@/lib/format";
import type { Event } from "@/lib/types";

/** A project is a row: title, period, "3/8" and a thin bar. */
export default function ProjectListView({
  events,
  selectedId,
  onSelect,
  loading,
}: {
  events: Event[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  const { t } = useI18n();
  if (loading) return null;

  if (events.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-text-muted">{t("No projects yet")}</p>
        <p className="text-[13px] text-text-faint mt-1">{t("Add one above to get started")}</p>
      </div>
    );
  }

  return (
    <div role="listbox" aria-label={t("Projects")}>
      {events.map((event) => {
        const todos = event.todos ?? [];
        const done = todos.filter((x) => x.completed).length;
        const percent = todos.length > 0 ? (done / todos.length) * 100 : 0;
        return (
          <div
            key={event.id}
            role="option"
            aria-selected={selectedId === event.id}
            tabIndex={0}
            data-task-row=""
            onClick={() => onSelect(event.id)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSelect(event.id); } }}
            className={`task-row ${selectedId === event.id ? "is-selected" : ""}`}
          >
            <span className="task-row-title">{event.title}</span>
            <span className="task-row-meta">
              {period(event, t) && <span className="task-meta-tag">{period(event, t)}</span>}
              <span className="w-16 h-1 rounded-full flex-none" style={{ background: "var(--surface-3)" }}>
                <span
                  className="block h-1 rounded-full"
                  style={{ width: `${percent}%`, background: "var(--accent)" }}
                />
              </span>
              <span className="tabular-nums">{done}/{todos.length}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function period(
  event: Event,
  t: (key: string, params?: Record<string, string | number>) => string
): string | null {
  if (!event.due_date) return null;
  const from = formatShortDate(event.due_date);
  if (!event.end_date || event.end_date === event.due_date) return from;
  return t("{from} to {to}", { from, to: formatShortDate(event.end_date) });
}
