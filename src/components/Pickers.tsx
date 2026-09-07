"use client";

import { CalendarDays, ChevronDown, Clock } from "lucide-react";
import { useI18n } from "./I18nProvider";
import Popover, { PopoverItem } from "./ui/Popover";
import DateTimePopover from "./ui/DateTimePopover";
import { formatRowDate, formatTime } from "@/lib/format";

/**
 * The three field-shaped pickers, all built on the one popover: surface,
 * 8 px radius, the popover shadow, Esc and a click outside close it. The
 * date picker is the same panel the detail panel and the quick input use,
 * so a date looks and behaves the same everywhere.
 */

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

/** The look every picker trigger shares: a 32 px field with a border. */
function fieldClass(extra?: string): string {
  return `inline-flex items-center gap-2 h-8 px-2 rounded surface-2 border border-border text-[13px] text-text hover:border-border-strong transition-default ${extra ?? ""}`;
}

export function CustomSelect({
  value,
  onChange,
  options,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const current = options.find((o) => o.value === value);

  return (
    <Popover
      label={placeholder}
      trigger={(p) => (
        <button
          type="button"
          ref={p.ref as (el: HTMLButtonElement | null) => void}
          onClick={p.onClick}
          aria-expanded={p["aria-expanded"]}
          className={fieldClass(className)}
          aria-label={placeholder}
        >
          {current?.color && (
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: current.color }} />
          )}
          <span className={`flex-1 text-left truncate ${current ? "" : "text-text-faint"}`}>
            {current ? t(current.label) : placeholder ?? t("Select")}
          </span>
          <ChevronDown size={14} className="flex-none text-text-faint" />
        </button>
      )}
    >
      {(close) => (
        <div className="min-w-[180px]">
          {options.map((option) => (
            <PopoverItem
              key={option.value}
              icon={
                option.color
                  ? <span className="w-2 h-2 rounded-full block ml-[7px] mr-[7px]" style={{ background: option.color }} />
                  : <span className="w-4 flex-none" />
              }
              onClick={() => { onChange(option.value); close(); }}
            >
              {t(option.label)}
            </PopoverItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className = "",
  trigger,
  triggerClassName,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** Kept for the old call sites; the popover now flips on its own. */
  dropUp?: boolean;
  /** Replace the field with something else, e.g. a chip. */
  trigger?: React.ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <DateTimePopover
      date={value || null}
      withTime={false}
      onChange={(date) => onChange(date ?? "")}
      label={ariaLabel ?? placeholder ?? t("Date")}
      trigger={(p) => (
        <button
          type="button"
          ref={p.ref as (el: HTMLButtonElement | null) => void}
          onClick={p.onClick}
          aria-expanded={p["aria-expanded"]}
          className={triggerClassName ?? fieldClass(className)}
          aria-label={ariaLabel ?? placeholder ?? t("Date")}
        >
          {trigger ?? (
            <>
              <CalendarDays size={14} className="flex-none text-text-faint" />
              <span className={value ? "" : "text-text-faint"}>
                {value ? t(formatRowDate(value)) : placeholder ?? t("Date")}
              </span>
            </>
          )}
        </button>
      )}
    />
  );
}

const TIME_CHIPS = ["09:00", "12:00", "15:00", "18:00"];

export function TimePicker({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const { t } = useI18n();

  return (
    <Popover
      label={placeholder ?? t("Time")}
      trigger={(p) => (
        <button
          type="button"
          ref={p.ref as (el: HTMLButtonElement | null) => void}
          onClick={p.onClick}
          aria-expanded={p["aria-expanded"]}
          className={fieldClass(className)}
          aria-label={placeholder ?? t("Time")}
        >
          <Clock size={14} className="flex-none text-text-faint" />
          <span className={value ? "tabular-nums" : "text-text-faint"}>
            {value ? formatTime(value) : placeholder ?? t("Time")}
          </span>
        </button>
      )}
    >
      {(close) => <TimeBody value={value} onChange={onChange} close={close} />}
    </Popover>
  );
}

function TimeBody({
  value,
  onChange,
  close,
}: {
  value: string;
  onChange: (v: string) => void;
  close: () => void;
}) {
  const { t } = useI18n();

  function commit(raw: string) {
    const clean = raw.trim();
    if (clean === "") { onChange(""); close(); return; }
    const match = /^(\d{1,2}):?(\d{2})$/.exec(clean);
    if (!match) return;
    const h = Math.min(23, Number(match[1]));
    const m = Math.min(59, Number(match[2]));
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    close();
  }

  return (
    <div className="w-[236px]">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          defaultValue={value}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit((e.target as HTMLInputElement).value); }
          }}
          placeholder="HH:MM"
          inputMode="numeric"
          aria-label={t("Time")}
          className="input w-[72px] flex-none text-center tabular-nums"
        />
        {TIME_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => { onChange(chip); close(); }}
            className="chip tabular-nums"
          >
            {chip}
          </button>
        ))}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); close(); }}
          className="btn btn-ghost w-full justify-start mt-1 h-8"
        >
          {t("No time")}
        </button>
      )}
    </div>
  );
}
