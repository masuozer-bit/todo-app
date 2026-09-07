"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { formatDateWithWeekday, monthNames, weekdayLabels } from "@/lib/format";
import { getToday } from "@/lib/date-helpers";
import type { JournalEntry } from "@/lib/types";

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Column 3 for the journal: a month with a dot on every day that holds
 * something, and the entries underneath, newest first.
 */
export default function JournalSidebar({
  entries,
  day,
  onSelectDay,
}: {
  entries: JournalEntry[];
  day: string;
  onSelectDay: (day: string) => void;
}) {
  const { t } = useI18n();
  const todayStr = getToday();
  const selected = new Date(`${day}T00:00:00`);
  const [year, setYear] = useState(selected.getFullYear());
  const [month, setMonth] = useState(selected.getMonth());

  const written = new Set(entries.filter((e) => e.content.trim() !== "").map((e) => e.entry_date));

  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  function step(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  return (
    <>
      <div className="app-col-head">
        <h2 className="flex-1 text-base font-medium text-text">{t("Journal")}</h2>
      </div>

      <div className="app-col-body">
        <div className="p-4 border-b border-border">
          <div className="flex items-center h-8">
            <button onClick={() => step(-1)} className="icon-btn w-7 h-7 flex-none" aria-label={t("Previous month")}>
              <ChevronLeft size={16} />
            </button>
            <span className="flex-1 text-center text-[13px] font-medium text-text">
              {monthNames()[month]} {year}
            </span>
            <button onClick={() => step(1)} className="icon-btn w-7 h-7 flex-none" aria-label={t("Next month")}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mt-1">
            {weekdayLabels("short").map((w) => (
              <span key={w} className="h-6 flex items-center justify-center text-xs text-text-faint">{w}</span>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <span key={`empty-${i}`} />;
              const ymd = toYMD(cell);
              const isSelected = ymd === day;
              const isToday = ymd === todayStr;
              return (
                <button
                  key={ymd}
                  onClick={() => onSelectDay(ymd)}
                  className="h-8 rounded text-[13px] tabular-nums flex flex-col items-center justify-center gap-0.5 transition-default"
                  style={{
                    background: isSelected ? "var(--accent)" : undefined,
                    color: isSelected ? "var(--accent-contrast)" : isToday ? "var(--accent)" : "var(--text)",
                    fontWeight: isToday && !isSelected ? 600 : 400,
                  }}
                  aria-current={isToday ? "date" : undefined}
                >
                  {cell.getDate()}
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: written.has(ymd)
                        ? (isSelected ? "var(--accent-contrast)" : "var(--accent)")
                        : "transparent",
                    }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <p className="section-title px-4 pt-4 pb-1">{t("Entries")}</p>
        {entries.length === 0 && (
          <p className="px-4 text-[13px] text-text-faint">{t("Nothing written yet")}</p>
        )}
        {entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelectDay(entry.entry_date)}
            className={`w-full text-left px-4 py-2 border-b border-border transition-default ${
              entry.entry_date === day ? "surface-2" : "hover:bg-surface-2"
            }`}
          >
            <span className="block text-[13px] text-text">{formatDateWithWeekday(entry.entry_date)}</span>
            <span className="block text-xs text-text-faint truncate">{entry.content}</span>
          </button>
        ))}
      </div>
    </>
  );
}
