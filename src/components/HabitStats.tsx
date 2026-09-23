"use client";

import type { ReactNode } from "react";
import { useI18n } from "./I18nProvider";
import { toDateStr } from "@/lib/date-helpers";
import { formatDateWithWeekday, formatLocale, weekdayLabels } from "@/lib/format";
import { dayState, habitStart, type DayState } from "@/lib/habit-stats";
import type { Habit, HabitTally } from "@/lib/types";

/** "86 %" in German, "86%" in English. Nothing when nothing was due. */
export function formatRate(tally: HabitTally): string | null {
  if (tally.due === 0) return null;
  return new Intl.NumberFormat(formatLocale(), { style: "percent", maximumFractionDigits: 0 }).format(
    tally.done / tally.due
  );
}

/**
 * A row of numbers under small labels, split by lines rather than boxed in
 * cards. A value of null says so in words instead of showing a zero.
 */
export function StatStrip({
  items,
}: {
  items: { label: string; value: string | null; extra?: ReactNode }[];
}) {
  const { t } = useI18n();
  return (
    <dl className="stat-strip">
      {items.map((item) => (
        <div key={item.label} className="stat-cell">
          <dt className="section-title truncate">{item.label}</dt>
          <dd className={`stat-value ${item.value === null ? "is-empty" : ""}`}>
            {item.value ?? t("Nothing yet")}
            {item.value !== null && item.extra}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const STATE_LABEL: Record<DayState, string> = {
  done: "Done",
  missed: "Missed",
  skipped: "Skipped",
  open: "Open",
  rest: "Not due",
};

/**
 * The last weeks as a grid, one column per week, Monday on top. It is the
 * habit's memory: what was done, what was missed, where it rested.
 */
export function HabitHistory({
  habit,
  done,
  skipped,
  weeks = 20,
}: {
  habit: Pick<Habit, "schedule_type" | "schedule_days" | "schedule_interval" | "created_at">;
  done: Set<string>;
  skipped: Set<string>;
  weeks?: number;
}) {
  const { t } = useI18n();
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const today = toDateStr(todayDate);
  const start = habitStart(habit, done);

  // Monday of the week that is `weeks - 1` weeks before this one
  const first = new Date(todayDate);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7) - (weeks - 1) * 7);

  let doneDays = 0;
  let dueDays = 0;
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(first);
    date.setDate(first.getDate() + i);
    const ymd = toDateStr(date);
    const state = dayState(habit, date, today, start, done, skipped);
    if (state === "done") { doneDays++; dueDays++; }
    if (state === "missed") dueDays++;
    return { ymd, state, future: ymd > today };
  });

  const labels = weekdayLabels("narrow");

  return (
    <div>
      <div className="history">
        <div className="history-days" aria-hidden="true">
          {labels.map((label, i) => (
            <span key={i}>{i % 2 === 0 ? label : ""}</span>
          ))}
        </div>
        <div
          className="history-grid"
          role="img"
          aria-label={t("Done on {done} of {due} due days in the last {weeks} weeks", {
            done: doneDays,
            due: dueDays,
            weeks,
          })}
        >
          {cells.map(({ ymd, state, future }) => (
            <span
              key={ymd}
              className={`history-cell is-${future ? "future" : state}`}
              title={future ? undefined : `${formatDateWithWeekday(ymd)}: ${t(STATE_LABEL[state])}`}
            />
          ))}
        </div>
      </div>
      <div className="history-legend" aria-hidden="true">
        <span><span className="history-cell is-done" />{t("Done")}</span>
        <span><span className="history-cell is-missed" />{t("Missed")}</span>
        <span><span className="history-cell is-skipped" />{t("Skipped")}</span>
        <span><span className="history-cell is-rest" />{t("Not due")}</span>
      </div>
    </div>
  );
}
