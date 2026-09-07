"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { formatDateWithWeekday } from "@/lib/format";
import { getToday } from "@/lib/date-helpers";
import type { JournalEntry } from "@/lib/types";

const SAVE_DEBOUNCE = 2000;

/**
 * One day, one entry. The editor writes on blur and every two seconds while
 * typing, the same rhythm the task notes use.
 */
export default function JournalView({
  entries,
  loading,
  onSave,
}: {
  entries: JournalEntry[];
  loading: boolean;
  onSave: (entryDate: string, content: string) => void;
}) {
  const { t } = useI18n();
  const [day, setDay] = useState<string>(() => getToday());
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayRef = useRef(day);
  dayRef.current = day;

  const stored = useMemo(
    () => entries.find((e) => e.entry_date === day)?.content ?? "",
    [entries, day]
  );

  // Switching day drops any pending write of the day being left
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setDraft(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  // A change arriving from elsewhere for the day on screen
  useEffect(() => {
    if (timer.current) return;
    setDraft(stored);
  }, [stored]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleChange(value: string) {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    const target = dayRef.current;
    timer.current = setTimeout(() => {
      timer.current = null;
      onSave(target, value);
    }, SAVE_DEBOUNCE);
  }

  function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (draft !== stored) onSave(day, draft);
  }

  function shiftDay(days: number) {
    flush();
    const d = new Date(`${day}T00:00:00`);
    d.setDate(d.getDate() + days);
    setDay(d.toISOString().slice(0, 10));
  }

  const today = getToday();
  const written = useMemo(
    () => new Set(entries.filter((e) => e.content.trim() !== "").map((e) => e.entry_date)),
    [entries]
  );

  return (
    <div className="max-w-[70ch]">
      <div className="flex items-center gap-1 mb-4">
        <button onClick={() => shiftDay(-1)} className="icon-btn flex-none" aria-label={t("Previous day")}>
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-base font-medium text-text px-1">{formatDateWithWeekday(day)}</h2>
        <button
          onClick={() => shiftDay(1)}
          className="icon-btn flex-none"
          aria-label={t("Next day")}
          disabled={day >= today}
        >
          <ChevronRight size={16} />
        </button>
        {day !== today && (
          <button onClick={() => { flush(); setDay(today); }} className="btn btn-ghost ml-1">
            {t("Today")}
          </button>
        )}
        <span className="flex-1" />
        <span className="text-xs text-text-faint">
          {t("{n} entries", { n: written.size })}
        </span>
      </div>

      <textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={flush}
        placeholder={loading ? "" : t("What happened today?")}
        aria-label={t("Journal")}
        className="w-full min-h-[420px] bg-transparent text-[15px] leading-relaxed text-text placeholder:text-text-faint resize-none focus:outline-none"
      />
    </div>
  );
}
