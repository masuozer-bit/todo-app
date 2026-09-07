"use client";

import { CalendarDays } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { formatLocale, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import type { FocusItem } from "@/lib/focus";
import type { List } from "@/lib/types";

/** "Fr 4." — short enough to sit in a 64 px column */
function shortDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(formatLocale(), {
    weekday: "short",
    day: "numeric",
  });
}

export default function FocusRow({
  item,
  list,
  selected,
  onToggle,
  onOpen,
}: {
  item: FocusItem;
  list?: List;
  /** Keyboard selection, moved with the arrow keys. */
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const { todo } = item;
  const bar = PRIORITY_META[todo.priority].bar;
  const fromCalendar = Boolean(todo.google_event_id);

  return (
    <div className={`focus-row ${selected ? "is-selected" : ""}`}>
      <button
        onClick={onToggle}
        className="focus-circle"
        aria-label={t("Mark as done")}
        aria-pressed={false}
      />
      <span className={`focus-time ${item.overdue ? "is-overdue" : ""}`}>
        {item.overdue ? shortDay(item.date) : item.time ? formatTime(item.time) : ""}
      </span>
      <span className="focus-marker">
        {fromCalendar ? (
          <CalendarDays size={16} aria-label={t("Calendar")} />
        ) : (
          <span className="focus-prio" style={bar ? { background: bar } : undefined} aria-hidden="true" />
        )}
      </span>
      <button onClick={onOpen} className="focus-row-title" title={todo.title}>
        {todo.title}
      </button>
      {list && (
        <span className="focus-row-list">
          <span
            className="focus-list-dot"
            style={{ background: list.color ?? "var(--text-faint)" }}
            aria-hidden="true"
          />
          <span>{list.name}</span>
        </span>
      )}
    </div>
  );
}
