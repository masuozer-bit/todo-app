"use client";

import { Flame } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { formatTime } from "@/lib/format";
import type { HabitWithStatus } from "@/lib/types";

/** What one of the seven dots behind a habit stands for. */
export type DayState = "done" | "missed" | "open" | "off";

export default function FocusHabitRow({
  habit,
  history,
  selected,
  onToggle,
}: {
  habit: HabitWithStatus;
  /** The last seven days, oldest first. */
  history: DayState[];
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const done = habit.completedToday;

  return (
    <div
      className={`focus-row ${selected ? "is-selected" : ""} ${done ? "is-done" : ""}`}
     
    >
      <button
        onClick={onToggle}
        className={`focus-circle ${done ? "is-on" : ""}`}
        aria-label={done ? t("Mark as not done") : t("Mark as done")}
        aria-pressed={done}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
      <span className="focus-time">{habit.time ? formatTime(habit.time) : ""}</span>
      <span className="focus-marker" aria-hidden="true" />
      <span className="focus-row-title">{habit.title}</span>
      <span className="focus-history" aria-hidden="true">
        {history.map((state, i) => (
          <span key={i} className={`focus-day-dot ${dotClass(state)}`} />
        ))}
      </span>
      {habit.streak > 0 && (
        <span className="focus-pill focus-pill-streak" title={t("Streak")}>
          <Flame size={12} />
          <span className="tabular-nums">{habit.streak}</span>
        </span>
      )}
    </div>
  );
}

function dotClass(state: DayState): string {
  if (state === "done") return "is-done";
  if (state === "missed") return "is-missed";
  if (state === "open") return "is-open";
  return "";
}
