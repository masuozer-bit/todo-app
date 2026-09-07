"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Sun, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import Popover from "@/components/ui/Popover";
import { monthNames, weekdayLabels } from "@/lib/format";
import { getToday } from "@/lib/date-helpers";

const TIME_CHIPS = ["09:00", "12:00", "15:00", "18:00"];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYMD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function shift(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

/** Monday of the coming week. */
function nextWeek(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return toYMD(d);
}

interface DateTimePopoverProps {
  date: string | null;
  time?: string | null;
  onChange: (date: string | null, time: string | null) => void;
  /** Leave out to offer only a date. */
  withTime?: boolean;
  trigger: (props: { ref: (el: HTMLElement | null) => void; onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean }) => ReactNode;
  align?: "start" | "end";
  label?: string;
}

/**
 * One date popover for the whole app: quick choices on the left, the month on
 * the right, the time underneath. No native date input except as the touch
 * fallback inside the time field.
 */
export default function DateTimePopover({
  date,
  time,
  onChange,
  withTime = true,
  trigger,
  align = "start",
  label,
}: DateTimePopoverProps) {
  const { t } = useI18n();
  return (
    <Popover align={align} label={label ?? t("Date")} trigger={trigger}>
      {(close) => (
        <Panel date={date} time={time ?? null} withTime={withTime} onChange={onChange} close={close} />
      )}
    </Popover>
  );
}

function Panel({
  date,
  time,
  withTime,
  onChange,
  close,
}: {
  date: string | null;
  time: string | null;
  withTime: boolean;
  onChange: (date: string | null, time: string | null) => void;
  close: () => void;
}) {
  const { t } = useI18n();
  const selected = parseYMD(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getToday();

  const [year, setYear] = useState((selected ?? today).getFullYear());
  const [month, setMonth] = useState((selected ?? today).getMonth());
  const [timeDraft, setTimeDraft] = useState(time ?? "");

  useEffect(() => { setTimeDraft(time ?? ""); }, [time]);

  const quick: { label: string; hint: string; value: string | null; icon: ReactNode }[] = [
    { label: "Today", hint: weekdayShort(0), value: shift(0), icon: <Sun size={16} /> },
    { label: "Tomorrow", hint: weekdayShort(1), value: shift(1), icon: <CalendarDays size={16} /> },
    { label: "Next Week", hint: "", value: nextWeek(), icon: <CalendarDays size={16} /> },
    { label: "No date", hint: "", value: null, icon: <X size={16} /> },
  ];

  // Monday first, so the grid matches how the week is written here
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

  function commitTime(value: string) {
    const clean = value.trim();
    if (clean === "") { onChange(date, null); return; }
    const match = /^(\d{1,2}):?(\d{2})$/.exec(clean);
    if (!match) return;
    const h = Math.min(23, Number(match[1]));
    const m = Math.min(59, Number(match[2]));
    onChange(date ?? todayStr, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  return (
    <div className="flex gap-2">
      <div className="flex flex-col gap-0.5 w-[152px] flex-none border-r border-border pr-2">
        {quick.map((q) => (
          <button
            key={q.label}
            onClick={() => { onChange(q.value, q.value === null ? null : time); close(); }}
            className="w-full flex items-center gap-2 h-8 px-2 rounded text-[13px] text-text hover:bg-surface-2 transition-default"
          >
            <span className="flex-none text-text-muted">{q.icon}</span>
            <span className="flex-1 text-left truncate">{t(q.label)}</span>
            {q.hint && <span className="text-xs text-text-faint">{q.hint}</span>}
          </button>
        ))}
      </div>

      <div className="w-[232px] flex-none">
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
            const isSelected = ymd === date;
            const isToday = ymd === todayStr;
            return (
              <button
                key={ymd}
                onClick={() => { onChange(ymd, time); close(); }}
                className="h-7 rounded text-[13px] tabular-nums transition-default"
                style={{
                  background: isSelected ? "var(--accent)" : undefined,
                  color: isSelected ? "var(--accent-contrast)" : isToday ? "var(--accent)" : "var(--text)",
                  fontWeight: isToday && !isSelected ? 600 : 400,
                }}
                aria-current={isToday ? "date" : undefined}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>

        {withTime && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
            <input
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
              onBlur={() => commitTime(timeDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitTime(timeDraft); close(); }
              }}
              placeholder="HH:MM"
              inputMode="numeric"
              aria-label={t("Time")}
              className="input w-[72px] flex-none text-center tabular-nums"
            />
            {TIME_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => { onChange(date ?? todayStr, chip); close(); }}
                className="chip tabular-nums"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function weekdayShort(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return weekdayLabels("short")[(d.getDay() + 6) % 7];
}
