"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Check, X, Calendar, Clock } from "lucide-react";

/* ─── helpers ──────────────────────────────────────────── */
function toDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

/* ══════════════════════════════════════════════════════════
   CustomSelect
══════════════════════════════════════════════════════════ */
export interface SelectOption {
  value: string;
  label: string;
  color?: string;
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
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 140 });
  const [domReady, setDomReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setDomReady(true); }, []);
  useClickOutside(popupRef, () => setOpen(false));

  const selected = options.find((o) => o.value === value);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 140) });
    }
    setOpen((o) => !o);
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-black/25 dark:hover:border-white/25 transition-default w-full"
      >
        {selected?.color && (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selected.color }} />
        )}
        <span className="flex-1 text-left truncate">{selected?.label ?? placeholder ?? "—"}</span>
        <ChevronDown
          size={11}
          className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {domReady && open && createPortal(
        <div
          ref={popupRef}
          className="glass-card-raised rounded-xl overflow-hidden py-1 shadow-2xl"
          style={{ position: "fixed", zIndex: 9999, top: popupPos.top, left: popupPos.left, minWidth: popupPos.width }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-default hover:bg-white/10 ${
                opt.value === value ? "text-white" : "text-white/60"
              }`}
            >
              {opt.color && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
              )}
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && <Check size={11} className="flex-shrink-0 text-white/50" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DatePicker
══════════════════════════════════════════════════════════ */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick date",
  className = "",
  dropUp = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  dropUp?: boolean;
}) {
  const today      = new Date();
  const todayStr   = toYMD(today);
  const parsed     = toDate(value);

  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState((parsed ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed ?? today).getMonth());
  const [popupPos, setPopupPos]   = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [domReady, setDomReady]   = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef   = useRef<HTMLDivElement>(null);
  useEffect(() => { setDomReady(true); }, []);
  useClickOutside(popupRef, () => setOpen(false));

  /* sync view to external value changes */
  useEffect(() => {
    const d = toDate(value);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear((y) => y - 1)) : setViewMonth((m) => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0), setViewYear((y) => y + 1)) : setViewMonth((m) => m + 1);

  /* build grid — Mon-first */
  const firstDay    = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  /* quick shortcuts */
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextMon   = new Date(today); nextMon.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  const quick = [
    { label: "Today",     val: todayStr },
    { label: "Tomorrow",  val: toYMD(tomorrow) },
    { label: "Next week", val: toYMD(nextMon) },
  ];

  const displayLabel = value
    ? (toDate(value)?.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) ?? value)
    : placeholder;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!open && triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setPopupPos(dropUp
              ? { top: r.top - 4, left: r.left }   // will be adjusted below
              : { top: r.bottom + 4, left: r.left }
            );
          }
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
          value
            ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-black dark:text-white"
            : "border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20"
        }`}
      >
        <Calendar size={11} className="flex-shrink-0" />
        <span>{displayLabel}</span>
        {value && (
          <span
            role="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default cursor-pointer ml-0.5"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {domReady && open && createPortal(
        <div
          ref={popupRef}
          className="glass-card-raised rounded-xl shadow-2xl p-3 w-64"
          style={{
            position: "fixed",
            zIndex: 9999,
            top: dropUp ? undefined : popupPos.top,
            bottom: dropUp ? `calc(100vh - ${popupPos.top}px)` : undefined,
            left: popupPos.left,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick shortcuts */}
          <div className="flex gap-1 mb-3">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => { onChange(q.val); setOpen(false); }}
                className={`flex-1 text-[10px] py-1.5 rounded-lg border transition-default ${
                  value === q.val
                    ? "border-white/30 bg-white/15 text-white font-medium"
                    : "border-white/10 text-white/50 hover:text-white hover:border-white/25"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-default"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-medium text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-default"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[9px] text-white/25 font-medium py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />;
              const ds        = toYMD(new Date(viewYear, viewMonth, day));
              const isToday   = ds === todayStr;
              const isSel     = ds === value;
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => { onChange(ds); setOpen(false); }}
                  className={`aspect-square text-[11px] rounded-lg flex items-center justify-center transition-default ${
                    isSel
                      ? "bg-white text-black font-semibold"
                      : isToday
                      ? "text-white ring-1 ring-white/40"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TimePicker  (scroll-snap columns)
══════════════════════════════════════════════════════════ */
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
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [domReady, setDomReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef   = useRef<HTMLDivElement>(null);
  const hRef   = useRef<HTMLDivElement>(null);
  const mRef   = useRef<HTMLDivElement>(null);
  useEffect(() => { setDomReady(true); }, []);
  useClickOutside(popupRef, () => setOpen(false));

  const parse = (v: string) => {
    if (!v) return { h: 9, m: 0 };
    const [hh, mm] = v.split(":").map(Number);
    return { h: hh, m: Math.round(mm / 5) * 5 % 60 };
  };

  const [selH, setSelH] = useState(() => parse(value).h);
  const [selM, setSelM] = useState(() => parse(value).m);

  useEffect(() => {
    const { h, m } = parse(value);
    setSelH(h); setSelM(m);
  }, [value]);

  /* scroll selected item into view when popup opens */
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      hRef.current?.children[selH]?.scrollIntoView({ block: "center", behavior: "instant" });
      mRef.current?.children[selM / 5]?.scrollIntoView({ block: "center", behavior: "instant" });
    }, 10);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (h: number, m: number) =>
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  const HOURS   = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

  const displayVal = value
    ? `${String(selH).padStart(2, "0")}:${String(selM).padStart(2, "0")}`
    : (placeholder ?? "Time");

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!open && triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setPopupPos({ top: r.bottom + 4, left: r.left });
          }
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-default ${
          value
            ? "border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-black dark:text-white"
            : "border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white hover:border-black/20 dark:hover:border-white/20"
        }`}
      >
        <Clock size={11} className="flex-shrink-0" />
        <span>{displayVal}</span>
        {value && (
          <span
            role="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            className="text-gray-400 hover:text-black dark:hover:text-white transition-default cursor-pointer ml-0.5"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {domReady && open && createPortal(
        <div
          ref={popupRef}
          className="glass-card-raised rounded-xl shadow-2xl p-2 flex gap-1.5"
          style={{ position: "fixed", zIndex: 9999, top: popupPos.top, left: popupPos.left, width: 120 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hours */}
          <div
            ref={hRef}
            className="flex-1 overflow-y-scroll snap-y snap-mandatory"
            style={{ height: 140, scrollbarWidth: "none" }}
          >
            {HOURS.map((h) => (
              <div key={h} className="snap-center">
                <button
                  type="button"
                  onClick={() => { setSelH(h); emit(h, selM); }}
                  className={`w-full py-1.5 text-xs rounded-lg transition-default text-center ${
                    h === selH
                      ? "bg-white/20 text-white font-semibold"
                      : "text-white/40 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {String(h).padStart(2, "0")}
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center text-white/30 text-sm self-center pb-1">:</div>

          {/* Minutes */}
          <div
            ref={mRef}
            className="flex-1 overflow-y-scroll snap-y snap-mandatory"
            style={{ height: 140, scrollbarWidth: "none" }}
          >
            {MINUTES.map((m) => (
              <div key={m} className="snap-center">
                <button
                  type="button"
                  onClick={() => { setSelM(m); emit(selH, m); }}
                  className={`w-full py-1.5 text-xs rounded-lg transition-default text-center ${
                    m === selM
                      ? "bg-white/20 text-white font-semibold"
                      : "text-white/40 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {String(m).padStart(2, "0")}
                </button>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
