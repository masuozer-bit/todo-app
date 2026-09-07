"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Check,
  Copy,
  FileText,
  Flag,
  FolderInput,
  GripVertical,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import Popover, { PopoverItem } from "@/components/ui/Popover";
import { formatRowDate, formatTime } from "@/lib/format";
import { PRIORITY_META } from "@/lib/priority";
import type { List as ListType, Priority, Todo } from "@/lib/types";

export interface TaskRowProps {
  todo: Todo;
  lists: ListType[];
  /** Hides the list name: inside a list view it would repeat on every row. */
  hideList?: boolean;
  selected?: boolean;
  /** Everything the timer touches. Undefined means the app has no timer here. */
  liveTaskId?: string | null;
  /** Manual sort is on, so the row shows a grip and can be dragged. */
  sortable?: boolean;
  /** Bulk select is on: the row leads with a checkbox instead of the circle. */
  selectMode?: boolean;
  checked?: boolean;
  highlighted?: boolean;

  onSelect: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (todo: Todo) => void;
  onSetPriority: (id: string, priority: Priority) => void;
  onSetList: (id: string, listId: string | null) => void;
  onOpenDatePicker?: (todo: Todo, anchor: HTMLElement) => void;
  onStartTimer?: (id: string) => void;
  onToggleChecked?: (id: string) => void;
  /** Arrow keys walk the list, so the list owns where focus goes next. */
  onKeyNav?: (direction: -1 | 1) => void;
}

const PRIORITY_CYCLE: Priority[] = ["none", "low", "medium", "high"];

export default function TaskRow({
  todo,
  lists,
  hideList = false,
  selected = false,
  liveTaskId,
  sortable = false,
  selectMode = false,
  checked = false,
  highlighted = false,
  onSelect,
  onToggle,
  onRename,
  onDelete,
  onDuplicate,
  onSetPriority,
  onSetList,
  onOpenDatePicker,
  onStartTimer,
  onToggleChecked,
  onKeyNav,
}: TaskRowProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dateBtnRef = useRef<HTMLButtonElement | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    disabled: !sortable,
  });

  useEffect(() => { if (!editing) setDraft(todo.title); }, [todo.title, editing]);

  const list = todo.list_id ? lists.find((l) => l.id === todo.list_id) ?? null : null;
  const priority = PRIORITY_META[todo.priority ?? "none"];
  const subtasks = todo.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.completed).length;
  const tags = todo.tags ?? [];
  const isLive = liveTaskId === todo.id;

  const todayStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, local
  const overdue = !todo.completed && !!todo.due_date && todo.due_date < todayStr;
  const dateLabel = todo.due_date
    ? `${t(formatRowDate(todo.due_date))}${todo.start_time ? ` ${formatTime(todo.start_time)}` : ""}`
    : null;

  function commitRename() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== todo.title) onRename(todo.id, next);
    else setDraft(todo.title);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (editing) return;
    if (e.key === "ArrowDown") { e.preventDefault(); onKeyNav?.(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); onKeyNav?.(-1); return; }
    if (e.key === " ") { e.preventDefault(); onToggle(todo.id, !todo.completed); return; }
    if (e.key === "Enter") { e.preventDefault(); onSelect(todo.id); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onDelete(todo.id); }
  }

  return (
    <div
      ref={(el) => { rowRef.current = el; setNodeRef(el); }}
      data-todo-id={todo.id}
      data-task-row=""
      tabIndex={0}
      role="option"
      aria-selected={selected}
      onKeyDown={handleKeyDown}
      onClick={() => { if (!editing) onSelect(todo.id); }}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`task-row group ${selected ? "is-selected" : ""} ${todo.completed ? "is-done" : ""} ${highlighted ? "is-highlighted" : ""}`}
    >
      {sortable && (
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="task-row-grip"
          aria-label={t("Reorder")}
          tabIndex={-1}
        >
          <GripVertical size={16} />
        </button>
      )}

      {selectMode ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleChecked?.(todo.id); }}
          className="task-circle is-square"
          aria-label={t("Select")}
          aria-pressed={checked}
        >
          {checked ? <Check size={11} strokeWidth={3} /> : <Square size={11} className="opacity-0" />}
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(todo.id, !todo.completed); }}
          className="task-circle"
          aria-label={todo.completed ? t("Mark as not done") : t("Mark as done")}
          aria-pressed={todo.completed}
        >
          {todo.completed && <Check size={11} strokeWidth={3} />}
        </button>
      )}

      {priority.bar && (
        <span className="task-pbar" style={{ background: priority.bar }} aria-label={t(priority.label)} />
      )}

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
            if (e.key === "Escape") { e.preventDefault(); setDraft(todo.title); setEditing(false); }
          }}
          aria-label={t("Task title")}
          className="flex-1 min-w-0 bg-transparent text-sm text-text focus:outline-none"
        />
      ) : (
        <span
          onDoubleClick={(e) => { e.stopPropagation(); if (!todo.completed) setEditing(true); }}
          className="task-row-title"
          title={todo.title}
        >
          {todo.title}
        </span>
      )}

      <span className="task-row-meta">
        {subtasks.length > 0 && (
          <span className="task-meta-item" title={t("Subtasks")}>
            <ListChecks size={14} />
            <span className="tabular-nums">{doneSubtasks}/{subtasks.length}</span>
          </span>
        )}
        {todo.notes && <FileText size={14} className="task-meta-icon" aria-label={t("Notes")} />}
        {tags.slice(0, 2).map((tag) => (
          <span key={tag.id} className="task-meta-tag">{tag.name}</span>
        ))}
        {tags.length > 2 && <span className="task-meta-tag">+{tags.length - 2}</span>}
        {!hideList && list && (
          <span className="task-meta-item task-meta-list">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: list.color ?? "var(--text-faint)" }} />
            {list.name}
          </span>
        )}
        {dateLabel && (
          <button
            ref={dateBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              if (dateBtnRef.current) onOpenDatePicker?.(todo, dateBtnRef.current);
            }}
            className="task-meta-date"
            style={overdue ? { color: "var(--danger)" } : undefined}
          >
            {dateLabel}
          </button>
        )}
      </span>

      <span className="task-row-actions">
        {onStartTimer && !todo.completed && (
          <button
            onClick={(e) => { e.stopPropagation(); onStartTimer(todo.id); }}
            className={`icon-btn w-7 h-7 ${isLive ? "icon-btn-on" : ""}`}
            aria-label={t("Start timer")}
            title={t("Start timer")}
          >
            <Play size={14} />
          </button>
        )}
        <Popover
          align="end"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          label={t("Task options")}
          trigger={(p) => (
            <button
              ref={p.ref as (el: HTMLButtonElement | null) => void}
              onClick={(e) => { e.stopPropagation(); p.onClick(e); }}
              aria-expanded={p["aria-expanded"]}
              className="icon-btn w-7 h-7"
              aria-label={t("Task options")}
            >
              <MoreHorizontal size={14} />
            </button>
          )}
        >
          {(close) => (
            <div className="min-w-[220px]">
              <PopoverItem icon={<Pencil size={16} />} shortcut="Enter" onClick={() => { close(); setEditing(true); }}>
                {t("Rename")}
              </PopoverItem>
              {onOpenDatePicker && (
                <PopoverItem
                  icon={<CalendarDays size={16} />}
                  onClick={() => { close(); if (rowRef.current) onOpenDatePicker(todo, rowRef.current); }}
                >
                  {t("Date")}
                </PopoverItem>
              )}
              <div className="my-1 h-px bg-border" />
              <p className="px-2 pb-1 text-xs text-text-faint">{t("Priority")}</p>
              {PRIORITY_CYCLE.slice().reverse().map((p) => (
                <PopoverItem
                  key={p}
                  icon={
                    PRIORITY_META[p].bar
                      ? <span className="w-[3px] h-4 rounded-full block ml-[6px] mr-[6px]" style={{ background: PRIORITY_META[p].bar as string }} />
                      : <Flag size={16} />
                  }
                  onClick={() => { close(); onSetPriority(todo.id, p); }}
                >
                  {t(PRIORITY_META[p].label)}
                </PopoverItem>
              ))}
              {lists.length > 0 && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <p className="px-2 pb-1 text-xs text-text-faint">{t("Move to list")}</p>
                  {todo.list_id && (
                    <PopoverItem icon={<FolderInput size={16} />} onClick={() => { close(); onSetList(todo.id, null); }}>
                      {t("No list")}
                    </PopoverItem>
                  )}
                  {lists.filter((l) => l.id !== todo.list_id).map((l) => (
                    <PopoverItem
                      key={l.id}
                      icon={<span className="w-2 h-2 rounded-full block ml-[7px] mr-[7px]" style={{ background: l.color ?? "var(--text-faint)" }} />}
                      onClick={() => { close(); onSetList(todo.id, l.id); }}
                    >
                      {l.name}
                    </PopoverItem>
                  ))}
                </>
              )}
              <div className="my-1 h-px bg-border" />
              {onDuplicate && (
                <PopoverItem icon={<Copy size={16} />} onClick={() => { close(); onDuplicate(todo); }}>
                  {t("Duplicate")}
                </PopoverItem>
              )}
              <PopoverItem icon={<Trash2 size={16} />} danger shortcut="Del" onClick={() => { close(); onDelete(todo.id); }}>
                {t("Delete")}
              </PopoverItem>
            </div>
          )}
        </Popover>
      </span>
    </div>
  );
}
