"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { formatLocale } from "@/lib/format";

export interface WeekDay {
  /** YYYY-MM-DD */
  date: string;
  isToday: boolean;
  isPast: boolean;
  /** What is still open on that day, tasks and habits together. */
  openCount: number;
  doneCount: number;
  totalCount: number;
  /** The first two entries, tasks before habits. */
  titles: string[];
  /** How many entries the two titles do not show. */
  more: number;
}

/**
 * The week beside the day. It answers "what is coming", not "what do I do",
 * so it stays a list of days with two titles each and no controls.
 */
export default function WeekPanel({
  days,
  onSelectDay,
}: {
  days: WeekDay[];
  onSelectDay: (date: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="focus-week">
      {days.map((day) => {
        const [, , dayNum] = day.date.split("-");
        return (
          <button
            key={day.date}
            onClick={() => onSelectDay(day.date)}
            className={`focus-week-row ${day.isToday ? "is-today" : ""} ${day.isPast ? "is-past" : ""}`}
          >
            <span className={`focus-day-tile ${day.isToday ? "is-today" : ""}`}>
              <span className="focus-day-name">{weekdayName(day.date)}</span>
              <span className="focus-day-num">{Number(dayNum)}</span>
            </span>

            <span className="focus-week-titles">
              {day.titles.length === 0 ? (
                <p style={{ color: "var(--text-faint)" }}>{t("Nothing planned")}</p>
              ) : (
                <>
                  {day.titles.map((title, i) => (
                    <p key={i}>{title}</p>
                  ))}
                  {day.more > 0 && (
                    <p style={{ color: "var(--text-faint)" }}>
                      {t("+ {n} more", { n: day.more })}
                    </p>
                  )}
                </>
              )}
            </span>

            {day.isPast ? (
              day.totalCount > 0 && (
                <span className="focus-pill">
                  <Check size={12} />
                  <span className="tabular-nums">
                    {day.doneCount}/{day.totalCount}
                  </span>
                </span>
              )
            ) : (
              day.openCount > 0 && (
                <span className={`focus-pill ${day.isToday ? "focus-pill-accent" : ""}`}>
                  <span className="tabular-nums">{day.openCount}</span>
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}

function weekdayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString(formatLocale(), { weekday: "short" });
}
