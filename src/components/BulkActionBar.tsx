"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Trash2, X, ArrowRight, CalendarDays, Flag } from "lucide-react";
import type { List, Priority } from "@/lib/types";
import { getToday, getTomorrow, getNextMonday } from "@/lib/date-helpers";

interface BulkActionBarProps {
  selectedCount: number;
  /** Keep the bar on screen while select mode is active, even at 0 selected */
  visible?: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onMoveToList?: (listId: string | null) => void;
  onSetDueDate?: (date: string | null) => void;
  onSetPriority?: (priority: Priority) => void;
  onCancel: () => void;
  lists?: List[];
}

/* Small click-to-open menu — hover menus are unusable on touch */
function Menu({
  label,
  icon,
  disabled,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl hover:bg-white/15 dark:hover:bg-black/10 transition-default disabled:opacity-40"
        title={label}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 min-w-[150px]" role="menu">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-black/10 dark:border-white/10 shadow-xl py-1 text-black dark:text-white max-h-64 overflow-y-auto">
            {children(() => setOpen(false))}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  muted,
}: {
  onClick: () => void;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-default ${
        muted ? "text-gray-400" : ""
      }`}
    >
      {children}
    </button>
  );
}

export default function BulkActionBar({
  selectedCount,
  visible = false,
  onComplete,
  onDelete,
  onMoveToList,
  onSetDueDate,
  onSetPriority,
  onCancel,
  lists = [],
}: BulkActionBarProps) {
  if (!visible && selectedCount === 0) return null;

  const nothingSelected = selectedCount === 0;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-1 bg-black dark:bg-white text-white dark:text-black rounded-2xl px-4 py-2.5 shadow-2xl border border-white/10 dark:border-black/10">
        <span className="text-sm font-medium tabular-nums mr-1">
          {selectedCount} selected
        </span>

        <div className="w-px h-5 bg-white/20 dark:bg-black/20" />

        <button
          onClick={onComplete}
          disabled={nothingSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl hover:bg-white/15 dark:hover:bg-black/10 transition-default disabled:opacity-40"
          title="Complete selected"
        >
          <Check size={14} />
          <span className="hidden sm:inline">Done</span>
        </button>

        {onSetDueDate && (
          <Menu label="Date" icon={<CalendarDays size={14} />} disabled={nothingSelected}>
            {(close) => (
              <>
                <MenuItem onClick={() => { onSetDueDate(getToday()); close(); }}>Today</MenuItem>
                <MenuItem onClick={() => { onSetDueDate(getTomorrow()); close(); }}>Tomorrow</MenuItem>
                <MenuItem onClick={() => { onSetDueDate(getNextMonday()); close(); }}>Next Monday</MenuItem>
                <MenuItem muted onClick={() => { onSetDueDate(null); close(); }}>No date</MenuItem>
              </>
            )}
          </Menu>
        )}

        {onSetPriority && (
          <Menu label="Priority" icon={<Flag size={14} />} disabled={nothingSelected}>
            {(close) => (
              <>
                <MenuItem onClick={() => { onSetPriority("high"); close(); }}>High</MenuItem>
                <MenuItem onClick={() => { onSetPriority("medium"); close(); }}>Medium</MenuItem>
                <MenuItem onClick={() => { onSetPriority("low"); close(); }}>Low</MenuItem>
                <MenuItem muted onClick={() => { onSetPriority("none"); close(); }}>None</MenuItem>
              </>
            )}
          </Menu>
        )}

        {lists.length > 0 && onMoveToList && (
          <Menu label="Move" icon={<ArrowRight size={14} />} disabled={nothingSelected}>
            {(close) => (
              <>
                <MenuItem muted onClick={() => { onMoveToList(null); close(); }}>No list</MenuItem>
                {lists.map((list) => (
                  <MenuItem key={list.id} onClick={() => { onMoveToList(list.id); close(); }}>
                    {list.name}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        )}

        <button
          onClick={onDelete}
          disabled={nothingSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl hover:bg-red-500/30 dark:hover:bg-red-500/20 text-red-300 dark:text-red-500 transition-default disabled:opacity-40"
          title="Delete selected"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>

        <div className="w-px h-5 bg-white/20 dark:bg-black/20" />

        <button
          onClick={onCancel}
          className="p-1.5 rounded-xl hover:bg-white/15 dark:hover:bg-black/10 transition-default"
          title="Cancel selection"
          aria-label="Cancel selection"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
