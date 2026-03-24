"use client";

import { useState, useEffect } from "react";
import { X, Plus, ChevronDown, ChevronUp, LayoutTemplate } from "lucide-react";
import type {
  Template,
  TaskTemplateData,
  EventTemplateData,
  PlanTemplateData,
  List,
  Priority,
} from "@/lib/types";
import { CustomSelect, TimePicker, DatePicker } from "./Pickers";

// ─── Types ────────────────────────────────────────────────────────────────────

type View =
  | { mode: "list" }
  | { mode: "detail"; template: Template }
  | { mode: "create"; editing?: Template };

const PRIORITIES: Priority[] = ["high", "medium", "low", "none"];
const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
  none: "bg-gray-500",
};

interface TaskDraft {
  _id: string;
  title: string;
  priority: Priority;
  estimated_time: string;
  list_id: string;
  notes: string;
  start_time: string;
  end_time: string;
  subtasks: string[];
  day: string;
}

interface EventDraft {
  _id: string;
  title: string;
  description: string;
  color: string;
  list_id: string;
  start_time: string;
  end_time: string;
  start_day: string;
  end_day: string;
  tasks: TaskDraft[];
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function emptyTask(day = "1"): TaskDraft {
  return {
    _id: uid(), title: "", priority: "none", estimated_time: "",
    list_id: "", notes: "", start_time: "", end_time: "", subtasks: [], day,
  };
}

function emptyEvent(): EventDraft {
  return {
    _id: uid(), title: "", description: "", color: "", list_id: "",
    start_time: "", end_time: "", start_day: "1", end_day: "1", tasks: [],
  };
}

function taskDraftToData(d: TaskDraft): TaskTemplateData {
  return {
    title: d.title,
    priority: d.priority !== "none" ? d.priority : undefined,
    estimated_time: d.estimated_time ? parseInt(d.estimated_time) : null,
    list_id: d.list_id || null,
    notes: d.notes || null,
    start_time: d.start_time || null,
    end_time: d.end_time || null,
    subtasks: d.subtasks.filter(Boolean),
    day: d.day ? parseInt(d.day) : 1,
  };
}

function eventDraftToData(d: EventDraft): EventTemplateData {
  return {
    title: d.title,
    description: d.description || null,
    color: d.color || null,
    list_id: d.list_id || null,
    start_time: d.start_time || null,
    end_time: d.end_time || null,
    start_day: d.start_day ? parseInt(d.start_day) : 1,
    end_day: d.end_day ? parseInt(d.end_day) : 1,
    tasks: d.tasks.filter((t) => t.title.trim()).map(taskDraftToData),
  };
}

function planDataToDrafts(data: PlanTemplateData): { tasks: TaskDraft[]; events: EventDraft[] } {
  return {
    tasks: data.tasks.map((t) => ({
      _id: uid(), title: t.title, priority: t.priority ?? "none",
      estimated_time: t.estimated_time?.toString() ?? "",
      list_id: t.list_id ?? "", notes: t.notes ?? "",
      start_time: t.start_time ?? "", end_time: t.end_time ?? "",
      subtasks: t.subtasks ?? [], day: t.day?.toString() ?? "1",
    })),
    events: data.events.map((e) => ({
      _id: uid(), title: e.title, description: e.description ?? "",
      color: e.color ?? "", list_id: e.list_id ?? "",
      start_time: e.start_time ?? "", end_time: e.end_time ?? "",
      start_day: e.start_day?.toString() ?? "1",
      end_day: e.end_day?.toString() ?? "1",
      tasks: (e.tasks ?? []).map((t) => ({
        _id: uid(), title: t.title, priority: t.priority ?? "none",
        estimated_time: t.estimated_time?.toString() ?? "",
        list_id: t.list_id ?? "", notes: t.notes ?? "",
        start_time: t.start_time ?? "", end_time: t.end_time ?? "",
        subtasks: t.subtasks ?? [], day: t.day?.toString() ?? e.start_day?.toString() ?? "1",
      })),
    })),
  };
}

function fmtEst(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ""}`;
}

const EVENT_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#f97316", label: "Orange" },
];

const INPUT =
  "text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors";
const LABEL = "text-[10px] text-white/40 uppercase tracking-wide mb-1.5";

// ─── TaskRow ──────────────────────────────────────────────────────────────────

function TaskRow({
  draft,
  onChange,
  onRemove,
  lists,
}: {
  draft: TaskDraft;
  onChange: (d: TaskDraft) => void;
  onRemove: () => void;
  lists: List[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [newSub, setNewSub] = useState("");

  const estNum = draft.estimated_time ? parseInt(draft.estimated_time) : 0;
  const estLabel = estNum > 0 ? fmtEst(estNum) : null;
  const listOpts = [
    { value: "", label: "No list" },
    ...lists.map((l) => ({ value: l.id, label: l.name, color: l.color ?? undefined })),
  ];

  function addSub() {
    if (!newSub.trim()) return;
    onChange({ ...draft, subtasks: [...draft.subtasks, newSub.trim()] });
    setNewSub("");
  }

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden bg-white/3">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="Task title..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none min-w-0"
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-white/30">Day</span>
          <input
            type="number"
            min={1}
            value={draft.day}
            onChange={(e) => onChange({ ...draft, day: e.target.value })}
            className="w-10 text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-white/30 text-center"
          />
        </div>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[draft.priority]}`} />
        {estLabel && (
          <span className="text-[10px] text-white/30 tabular-nums flex-shrink-0">{estLabel}</span>
        )}
        <button
          onClick={onRemove}
          className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
          <div>
            <p className={LABEL}>Priority</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => onChange({ ...draft, priority: p })}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                    draft.priority === p
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 text-white/40 hover:border-white/20"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[p]}`} />
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={LABEL}>Estimated time (minutes)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                placeholder="minutes"
                value={draft.estimated_time}
                onChange={(e) => onChange({ ...draft, estimated_time: e.target.value })}
                className={`w-24 ${INPUT}`}
              />
              {estLabel && <span className="text-xs text-white/30">{estLabel}</span>}
            </div>
          </div>

          <div>
            <p className={LABEL}>Default time</p>
            <div className="flex items-center gap-2 flex-wrap">
              <TimePicker
                value={draft.start_time}
                onChange={(v) => onChange({ ...draft, start_time: v })}
              />
              {draft.start_time && (
                <TimePicker
                  value={draft.end_time}
                  onChange={(v) => onChange({ ...draft, end_time: v })}
                />
              )}
            </div>
          </div>

          {lists.length > 0 && (
            <div>
              <p className={LABEL}>List</p>
              <CustomSelect
                value={draft.list_id}
                onChange={(v) => onChange({ ...draft, list_id: v })}
                options={listOpts}
                placeholder="No list"
              />
            </div>
          )}

          <div>
            <p className={LABEL}>Notes</p>
            <textarea
              value={draft.notes}
              onChange={(e) => onChange({ ...draft, notes: e.target.value })}
              placeholder="Notes..."
              rows={2}
              className={`w-full ${INPUT} resize-none`}
            />
          </div>

          <div>
            <p className={LABEL}>Subtasks</p>
            <div className="space-y-1 mb-1.5">
              {draft.subtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                  <span className="flex-1 text-xs text-white/70">{s}</span>
                  <button
                    onClick={() =>
                      onChange({ ...draft, subtasks: draft.subtasks.filter((_, j) => j !== i) })
                    }
                    className="text-white/30 hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSub();
                  }
                }}
                placeholder="Add subtask..."
                className={`flex-1 ${INPUT}`}
              />
              <button onClick={addSub} className="text-white/30 hover:text-white transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

function EventRow({
  draft,
  onChange,
  onRemove,
  lists,
}: {
  draft: EventDraft;
  onChange: (d: EventDraft) => void;
  onRemove: () => void;
  lists: List[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  const listOpts = [
    { value: "", label: "No list" },
    ...lists.map((l) => ({ value: l.id, label: l.name, color: l.color ?? undefined })),
  ];
  const colorOpts = [
    { value: "", label: "Default" },
    ...EVENT_COLORS.map((c) => ({ value: c.value, label: c.label, color: c.value })),
  ];

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden bg-white/3">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {draft.color && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: draft.color }}
            />
          )}
          <input
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="Event title..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none min-w-0"
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-white/30">Day</span>
          <input
            type="number"
            min={1}
            value={draft.start_day}
            onChange={(e) =>
              onChange({ ...draft, start_day: e.target.value, end_day: e.target.value })
            }
            className="w-10 text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-white/30 text-center"
          />
          {draft.start_day !== draft.end_day && (
            <>
              <span className="text-[10px] text-white/20">→</span>
              <input
                type="number"
                min={parseInt(draft.start_day) || 1}
                value={draft.end_day}
                onChange={(e) => onChange({ ...draft, end_day: e.target.value })}
                className="w-10 text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-white/30 text-center"
              />
            </>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
          <div>
            <p className={LABEL}>Color</p>
            <CustomSelect
              value={draft.color}
              onChange={(v) => onChange({ ...draft, color: v })}
              options={colorOpts}
              placeholder="Default color"
            />
          </div>
          {lists.length > 0 && (
            <div>
              <p className={LABEL}>List</p>
              <CustomSelect
                value={draft.list_id}
                onChange={(v) => onChange({ ...draft, list_id: v })}
                options={listOpts}
                placeholder="No list"
              />
            </div>
          )}
          <div>
            <p className={LABEL}>Default time</p>
            <div className="flex items-center gap-2 flex-wrap">
              <TimePicker
                value={draft.start_time}
                onChange={(v) => onChange({ ...draft, start_time: v })}
              />
              {draft.start_time && (
                <TimePicker
                  value={draft.end_time}
                  onChange={(v) => onChange({ ...draft, end_time: v })}
                />
              )}
            </div>
          </div>
          <div>
            <p className={LABEL}>End day (if multi-day)</p>
            <input
              type="number"
              min={parseInt(draft.start_day) || 1}
              value={draft.end_day}
              onChange={(e) => onChange({ ...draft, end_day: e.target.value })}
              className={`w-24 ${INPUT}`}
            />
          </div>
          <div>
            <p className={LABEL}>Description</p>
            <textarea
              value={draft.description}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
              placeholder="Description..."
              rows={2}
              className={`w-full ${INPUT} resize-none`}
            />
          </div>

          {/* Tasks within this event */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setTasksExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-[10px] text-white/40 uppercase tracking-wide hover:text-white/70 transition-colors"
              >
                {tasksExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                Tasks ({draft.tasks.length})
              </button>
              <button
                onClick={() =>
                  onChange({
                    ...draft,
                    tasks: [...draft.tasks, emptyTask(draft.start_day)],
                  })
                }
                className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white transition-colors"
              >
                <Plus size={11} /> Add task
              </button>
            </div>
            {tasksExpanded && (
              <div className="space-y-1.5 pl-2 border-l border-white/8">
                {draft.tasks.length === 0 && (
                  <p className="text-[11px] text-white/20 italic">No tasks yet</p>
                )}
                {draft.tasks.map((t, i) => (
                  <TaskRow
                    key={t._id}
                    draft={t}
                    onChange={(upd) =>
                      onChange({
                        ...draft,
                        tasks: draft.tasks.map((x, j) => (j === i ? upd : x)),
                      })
                    }
                    onRemove={() =>
                      onChange({ ...draft, tasks: draft.tasks.filter((_, j) => j !== i) })
                    }
                    lists={lists}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
  templates: Template[];
  lists: List[];
  onAdd: (t: { name: string; type: "plan"; data: PlanTemplateData }) => void;
  onUpdate: (id: string, updates: { name?: string; data?: PlanTemplateData }) => void;
  onDelete: (id: string) => void;
  onApply: (template: Template, startDate: string) => void;
}

export default function TemplatesModal({
  open,
  onClose,
  templates,
  lists,
  onAdd,
  onUpdate,
  onDelete,
  onApply,
}: TemplatesModalProps) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [eventDrafts, setEventDrafts] = useState<EventDraft[]>([]);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);

  // Auto-navigate to a newly saved template once it appears in the list
  useEffect(() => {
    if (!pendingSelect) return;
    const found = templates.find((t) => t.name === pendingSelect);
    if (found) {
      setView({ mode: "detail", template: found });
      setPendingSelect(null);
    }
  }, [templates, pendingSelect]);

  if (!open) return null;

  function openCreate() {
    setTemplateName("");
    setTaskDrafts([]);
    setEventDrafts([]);
    setView({ mode: "create" });
  }

  function openEdit(t: Template) {
    setTemplateName(t.name);
    if (t.type === "plan") {
      const { tasks, events } = planDataToDrafts(t.data as PlanTemplateData);
      setTaskDrafts(tasks);
      setEventDrafts(events);
    } else if (t.type === "task") {
      const data = t.data as TaskTemplateData;
      setTaskDrafts([
        {
          _id: uid(), title: data.title, priority: data.priority ?? "none",
          estimated_time: data.estimated_time?.toString() ?? "",
          list_id: data.list_id ?? "", notes: data.notes ?? "",
          start_time: data.start_time ?? "", end_time: data.end_time ?? "",
          subtasks: data.subtasks ?? [], day: data.day?.toString() ?? "1",
        },
      ]);
      setEventDrafts([]);
    } else {
      const data = t.data as EventTemplateData;
      setEventDrafts([
        {
          _id: uid(), title: data.title, description: data.description ?? "",
          color: data.color ?? "", list_id: data.list_id ?? "",
          start_time: data.start_time ?? "", end_time: data.end_time ?? "",
          start_day: data.start_day?.toString() ?? "1",
          end_day: data.end_day?.toString() ?? "1",
          tasks: (data.tasks ?? []).map((tsk) => ({
            _id: uid(), title: tsk.title, priority: tsk.priority ?? "none",
            estimated_time: tsk.estimated_time?.toString() ?? "",
            list_id: tsk.list_id ?? "", notes: tsk.notes ?? "",
            start_time: tsk.start_time ?? "", end_time: tsk.end_time ?? "",
            subtasks: tsk.subtasks ?? [], day: tsk.day?.toString() ?? data.start_day?.toString() ?? "1",
          })),
        },
      ]);
      setTaskDrafts([]);
    }
    setView({ mode: "create", editing: t });
  }

  function handleSave() {
    const name = templateName.trim();
    if (!name) return;
    const planData: PlanTemplateData = {
      tasks: taskDrafts.filter((t) => t.title.trim()).map(taskDraftToData),
      events: eventDrafts.filter((e) => e.title.trim()).map(eventDraftToData),
    };
    const editing = view.mode === "create" ? view.editing : undefined;
    if (editing) {
      onUpdate(editing.id, { name, data: planData });
      setView({ mode: "detail", template: { ...editing, name, data: planData } });
    } else {
      onAdd({ name, type: "plan", data: planData });
      setPendingSelect(name);
      setView({ mode: "list" });
    }
  }

  function getMaxDay(t: Template): number {
    if (t.type === "plan") {
      const data = t.data as PlanTemplateData;
      return Math.max(
        1,
        ...data.tasks.map((x) => x.day ?? 1),
        ...data.events.flatMap((e) => [e.start_day ?? 1, e.end_day ?? 1])
      );
    }
    if (t.type === "event") {
      const data = t.data as EventTemplateData;
      return Math.max(
        1,
        data.start_day ?? 1,
        data.end_day ?? 1,
        ...(data.tasks ?? []).map((x) => x.day ?? 1)
      );
    }
    return 1;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card-raised rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex overflow-hidden"
        style={{ background: "rgba(15,15,20,0.92)", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left sidebar ── */}
        <div className="w-52 border-r border-white/8 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Templates</p>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {templates.length === 0 && (
              <p className="text-[11px] text-white/20 italic px-1 mt-2">No templates yet</p>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setApplyDate("");
                  setView({ mode: "detail", template: t });
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  view.mode === "detail" && view.template.id === t.id
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span className="block truncate">{t.name}</span>
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-white/8">
            <button
              onClick={openCreate}
              className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-colors"
            >
              <Plus size={12} />
              New template
            </button>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Empty state */}
          {view.mode === "list" && (
            <div className="flex flex-col items-center justify-center h-full text-center p-10 gap-4">
              <LayoutTemplate size={36} className="text-white/10" />
              <div>
                <p className="text-sm font-medium text-white/50 mb-1">No template selected</p>
                <p className="text-xs text-white/25">Pick a template or create a new one</p>
              </div>
              <button
                onClick={openCreate}
                className="text-xs px-4 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-colors"
              >
                Create template
              </button>
            </div>
          )}

          {/* Detail / Apply */}
          {view.mode === "detail" &&
            (() => {
              const t = view.template;
              const maxDay = getMaxDay(t);
              const planData: PlanTemplateData =
                t.type === "plan"
                  ? (t.data as PlanTemplateData)
                  : t.type === "task"
                  ? { tasks: [t.data as TaskTemplateData], events: [] }
                  : {
                      tasks: (t.data as EventTemplateData).tasks ?? [],
                      events: [t.data as EventTemplateData],
                    };

              // Build day groups
              const groups: Record<number, { tasks: TaskTemplateData[]; events: EventTemplateData[] }> = {};
              for (const task of planData.tasks) {
                const d = task.day ?? 1;
                if (!groups[d]) groups[d] = { tasks: [], events: [] };
                groups[d].tasks.push(task);
              }
              for (const evt of planData.events) {
                const d = evt.start_day ?? 1;
                if (!groups[d]) groups[d] = { tasks: [], events: [] };
                groups[d].events.push(evt);
              }
              const days = Object.keys(groups).map(Number).sort((a, b) => a - b);
              const taskCount = planData.tasks.length;
              const evtCount = planData.events.length;

              return (
                <>
                  <div className="px-6 pt-5 pb-3 border-b border-white/8 flex items-start justify-between gap-3 flex-shrink-0">
                    <div>
                      <h2 className="text-base font-semibold text-white mb-1.5">{t.name}</h2>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {maxDay > 1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50">
                            {maxDay} days
                          </span>
                        )}
                        {taskCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50">
                            {taskCount} task{taskCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {evtCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50">
                            {evtCount} event{evtCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-colors"
                      >
                        Edit
                      </button>
                      {confirmDelete === t.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              onDelete(t.id);
                              setConfirmDelete(null);
                              setView({ mode: "list" });
                            }}
                            className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs px-2 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          className="text-white/30 hover:text-red-400 transition-colors"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {days.map((day) => (
                      <div key={day}>
                        {maxDay > 1 && (
                          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2 font-medium">
                            Day {day}
                          </p>
                        )}
                        <div className="space-y-1.5">
                          {groups[day].events.map((e, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8"
                            >
                              {e.color ? (
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ background: e.color }}
                                />
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-white/20" />
                              )}
                              <span className="text-sm text-white font-medium flex-1">
                                {e.title || (
                                  <span className="text-white/30 italic">Untitled event</span>
                                )}
                              </span>
                              {e.start_time && (
                                <span className="text-[10px] text-white/30 tabular-nums">
                                  {e.start_time}
                                </span>
                              )}
                            </div>
                          ))}
                          {groups[day].tasks.map((task, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-white/5"
                            >
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  task.priority === "high"
                                    ? "bg-red-500"
                                    : task.priority === "medium"
                                    ? "bg-amber-500"
                                    : task.priority === "low"
                                    ? "bg-blue-500"
                                    : "bg-gray-500"
                                }`}
                              />
                              <span className="text-sm text-white/70 flex-1">
                                {task.title || (
                                  <span className="text-white/30 italic">Untitled task</span>
                                )}
                              </span>
                              {task.estimated_time != null && task.estimated_time > 0 && (
                                <span className="text-[10px] text-white/30 tabular-nums">
                                  {fmtEst(task.estimated_time)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {days.length === 0 && (
                      <p className="text-sm text-white/25 italic text-center py-8">
                        This template has no items yet.
                      </p>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-white/8 flex-shrink-0">
                    <p className="text-xs text-white/40 mb-2">
                      {maxDay > 1 ? "Start date — Day 1 will be this date" : "Apply to date"}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <DatePicker
                          value={applyDate}
                          onChange={setApplyDate}
                          placeholder="Pick a date..."
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (applyDate) {
                            onApply(t, applyDate);
                            setApplyDate("");
                            onClose();
                          }
                        }}
                        disabled={!applyDate}
                        className="px-4 py-1.5 rounded-xl text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

          {/* Create / Edit */}
          {view.mode === "create" && (
            <>
              <div className="px-6 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="w-full bg-transparent text-base font-semibold text-white placeholder:text-white/25 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Tasks */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-white/60">Tasks</p>
                    <button
                      onClick={() => setTaskDrafts((prev) => [...prev, emptyTask()])}
                      className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white transition-colors"
                    >
                      <Plus size={12} /> Add task
                    </button>
                  </div>
                  {taskDrafts.length === 0 && (
                    <p className="text-[11px] text-white/20 italic">No tasks yet</p>
                  )}
                  <div className="space-y-2">
                    {taskDrafts.map((t, i) => (
                      <TaskRow
                        key={t._id}
                        draft={t}
                        onChange={(upd) =>
                          setTaskDrafts((prev) => prev.map((x, j) => (j === i ? upd : x)))
                        }
                        onRemove={() => setTaskDrafts((prev) => prev.filter((_, j) => j !== i))}
                        lists={lists}
                      />
                    ))}
                  </div>
                </div>

                {/* Events */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-white/60">Events</p>
                    <button
                      onClick={() => setEventDrafts((prev) => [...prev, emptyEvent()])}
                      className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white transition-colors"
                    >
                      <Plus size={12} /> Add event
                    </button>
                  </div>
                  {eventDrafts.length === 0 && (
                    <p className="text-[11px] text-white/20 italic">No events yet</p>
                  )}
                  <div className="space-y-2">
                    {eventDrafts.map((e, i) => (
                      <EventRow
                        key={e._id}
                        draft={e}
                        onChange={(upd) =>
                          setEventDrafts((prev) => prev.map((x, j) => (j === i ? upd : x)))
                        }
                        onRemove={() => setEventDrafts((prev) => prev.filter((_, j) => j !== i))}
                        lists={lists}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/8 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => setView({ mode: "list" })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!templateName.trim()}
                  className="text-xs px-4 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {view.editing ? "Save changes" : "Save template"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
