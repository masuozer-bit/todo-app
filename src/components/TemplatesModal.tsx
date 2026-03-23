"use client";

import { useState } from "react";
import { X, Plus, Trash2, ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import type { Template, TaskTemplateData, EventTemplateData, List, Priority } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type View =
  | { mode: "list" }
  | { mode: "detail"; template: Template }
  | { mode: "form"; templateType: "task" | "event"; editing?: Template };

const PRIORITIES: Priority[] = ["high", "medium", "low", "none"];
const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-500",
  none: "bg-gray-300 dark:bg-gray-600",
};

interface TaskDraft {
  title: string;
  priority: Priority;
  estimated_time: string;
  list_id: string;
  notes: string;
  start_time: string;
  end_time: string;
  subtasks: string[];
}

interface EventDraft {
  title: string;
  description: string;
  color: string;
  list_id: string;
  start_time: string;
  end_time: string;
  tasks: TaskDraft[];
}

function emptyTask(): TaskDraft {
  return { title: "", priority: "none", estimated_time: "", list_id: "", notes: "", start_time: "", end_time: "", subtasks: [] };
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
  };
}

function taskDataToDraft(d: TaskTemplateData): TaskDraft {
  return {
    title: d.title,
    priority: d.priority ?? "none",
    estimated_time: d.estimated_time?.toString() ?? "",
    list_id: d.list_id ?? "",
    notes: d.notes ?? "",
    start_time: d.start_time ?? "",
    end_time: d.end_time ?? "",
    subtasks: d.subtasks ?? [],
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
    tasks: d.tasks.map(taskDraftToData),
  };
}

function eventDataToDraft(d: EventTemplateData): EventDraft {
  return {
    title: d.title,
    description: d.description ?? "",
    color: d.color ?? "",
    list_id: d.list_id ?? "",
    start_time: d.start_time ?? "",
    end_time: d.end_time ?? "",
    tasks: d.tasks.map(taskDataToDraft),
  };
}

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT =
  "text-xs bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-black dark:text-white focus:outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors";

// ─── TaskForm (used inside event template editor) ─────────────────────────────

function TaskForm({
  draft,
  onChange,
  lists,
  index,
  onRemove,
}: {
  draft: TaskDraft;
  onChange: (d: TaskDraft) => void;
  lists: List[];
  index: number;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newSub, setNewSub] = useState("");

  function addSub() {
    if (!newSub.trim()) return;
    onChange({ ...draft, subtasks: [...draft.subtasks, newSub.trim()] });
    setNewSub("");
  }

  const estNum = draft.estimated_time ? parseInt(draft.estimated_time) : 0;
  const estLabel = estNum > 0
    ? estNum < 60 ? `${estNum}m` : `${Math.floor(estNum / 60)}h${estNum % 60 > 0 ? ` ${estNum % 60}m` : ""}`
    : null;

  return (
    <div className="border border-black/8 dark:border-white/8 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-black dark:hover:text-white transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder={`Task ${index + 1} title...`}
          className="flex-1 bg-transparent text-sm text-black dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0"
        />
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[draft.priority]}`} />
        {estLabel && <span className="text-[10px] text-black/40 dark:text-gray-600 tabular-nums flex-shrink-0">{estLabel}</span>}
        <button onClick={onRemove} className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0">
          <X size={12} />
        </button>
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-black/5 dark:border-white/5 pt-3">
          {/* Priority */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Priority</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => onChange({ ...draft, priority: p })}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                    draft.priority === p
                      ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white"
                      : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[p]}`} />
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated time */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Estimated time</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                placeholder="minutes"
                value={draft.estimated_time}
                onChange={(e) => onChange({ ...draft, estimated_time: e.target.value })}
                className={`w-24 ${INPUT}`}
              />
              {estLabel && <span className="text-xs text-black/40 dark:text-gray-500">{estLabel}</span>}
            </div>
          </div>

          {/* Time */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Default time</p>
            <div className="flex items-center gap-2">
              <input type="time" value={draft.start_time} onChange={(e) => onChange({ ...draft, start_time: e.target.value })} className={INPUT} />
              {draft.start_time && (
                <input type="time" value={draft.end_time} onChange={(e) => onChange({ ...draft, end_time: e.target.value })} className={INPUT} />
              )}
            </div>
          </div>

          {/* List */}
          {lists.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">List</p>
              <select value={draft.list_id} onChange={(e) => onChange({ ...draft, list_id: e.target.value })} className={`${INPUT} cursor-pointer`}>
                <option value="">No list</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Notes</p>
            <textarea
              value={draft.notes}
              onChange={(e) => onChange({ ...draft, notes: e.target.value })}
              placeholder="Notes..."
              rows={2}
              className={`w-full ${INPUT} resize-none`}
            />
          </div>

          {/* Subtasks */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Subtasks</p>
            <div className="space-y-1 mb-1.5">
              {draft.subtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-black/20 dark:bg-white/20 flex-shrink-0" />
                  <span className="flex-1 text-xs text-black dark:text-white">{s}</span>
                  <button
                    onClick={() => onChange({ ...draft, subtasks: draft.subtasks.filter((_, j) => j !== i) })}
                    className="text-gray-400 hover:text-red-400 transition-colors"
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
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                placeholder="Add subtask..."
                className={`flex-1 ${INPUT}`}
              />
              <button onClick={addSub} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
  templates: Template[];
  lists: List[];
  onAdd: (t: { name: string; type: "task" | "event"; data: TaskTemplateData | EventTemplateData }) => void;
  onUpdate: (id: string, updates: { name?: string; data?: TaskTemplateData | EventTemplateData }) => void;
  onDelete: (id: string) => void;
  onApplyTask: (data: TaskTemplateData) => void;
  onApplyEvent: (data: EventTemplateData, date: string) => void;
}

export default function TemplatesModal({
  open,
  onClose,
  templates,
  lists,
  onAdd,
  onUpdate,
  onDelete,
  onApplyTask,
  onApplyEvent,
}: TemplatesModalProps) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [applyDate, setApplyDate] = useState("");
  const [showApplyDate, setShowApplyDate] = useState(false);

  // Form state
  const [templateName, setTemplateName] = useState("");
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyTask());
  const [eventDraft, setEventDraft] = useState<EventDraft>({
    title: "", description: "", color: "", list_id: "", start_time: "", end_time: "", tasks: [],
  });
  const [newSub, setNewSub] = useState("");

  if (!open) return null;

  const taskTemplates = templates.filter((t) => t.type === "task");
  const eventTemplates = templates.filter((t) => t.type === "event");

  function openCreate(type: "task" | "event") {
    setTemplateName("");
    setTaskDraft(emptyTask());
    setEventDraft({ title: "", description: "", color: "", list_id: "", start_time: "", end_time: "", tasks: [] });
    setNewSub("");
    setView({ mode: "form", templateType: type });
  }

  function openEdit(t: Template) {
    setTemplateName(t.name);
    if (t.type === "task") {
      setTaskDraft(taskDataToDraft(t.data as TaskTemplateData));
    } else {
      setEventDraft(eventDataToDraft(t.data as EventTemplateData));
    }
    setNewSub("");
    setView({ mode: "form", templateType: t.type, editing: t });
  }

  function handleSave() {
    if (view.mode !== "form") return;
    const name = templateName.trim();
    if (!name) return;
    const data = view.templateType === "task" ? taskDraftToData(taskDraft) : eventDraftToData(eventDraft);
    if (!data.title.trim()) return;
    if (view.editing) {
      onUpdate(view.editing.id, { name, data });
    } else {
      onAdd({ name, type: view.templateType, data });
    }
    setView({ mode: "list" });
  }

  function handleApply(t: Template) {
    if (t.type === "task") {
      onApplyTask(t.data as TaskTemplateData);
      onClose();
    } else {
      setShowApplyDate(true);
    }
  }

  function handleApplyEvent(t: Template) {
    if (!applyDate) return;
    onApplyEvent(t.data as EventTemplateData, applyDate);
    setApplyDate("");
    setShowApplyDate(false);
    onClose();
  }

  function addSubToTask() {
    if (!newSub.trim()) return;
    setTaskDraft((d) => ({ ...d, subtasks: [...d.subtasks, newSub.trim()] }));
    setNewSub("");
  }

  const taskEstNum = taskDraft.estimated_time ? parseInt(taskDraft.estimated_time) : 0;
  const taskEstLabel = taskEstNum > 0
    ? taskEstNum < 60 ? `${taskEstNum}m` : `${Math.floor(taskEstNum / 60)}h${taskEstNum % 60 > 0 ? ` ${taskEstNum % 60}m` : ""}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: template list ── */}
        <div className="w-52 border-r border-black/8 dark:border-white/8 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-black/8 dark:border-white/8 flex items-center justify-between">
            <p className="text-sm font-semibold text-black dark:text-white">Templates</p>
            <button onClick={onClose} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {/* Task templates */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Tasks</p>
                <button
                  onClick={() => openCreate("task")}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  title="New task template"
                >
                  <Plus size={13} />
                </button>
              </div>
              {taskTemplates.length === 0 && (
                <p className="text-[11px] text-gray-300 dark:text-gray-600 italic px-1">None yet</p>
              )}
              {taskTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setShowApplyDate(false); setView({ mode: "detail", template: t }); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    view.mode === "detail" && view.template.id === t.id
                      ? "bg-black/8 dark:bg-white/8 text-black dark:text-white font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Event templates */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Events</p>
                <button
                  onClick={() => openCreate("event")}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  title="New event template"
                >
                  <Plus size={13} />
                </button>
              </div>
              {eventTemplates.length === 0 && (
                <p className="text-[11px] text-gray-300 dark:text-gray-600 italic px-1">None yet</p>
              )}
              {eventTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setShowApplyDate(false); setView({ mode: "detail", template: t }); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    view.mode === "detail" && view.template.id === t.id
                      ? "bg-black/8 dark:bg-white/8 text-black dark:text-white font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: content ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Empty state */}
          {view.mode === "list" && (
            <div className="flex flex-col items-center justify-center h-full text-center p-10 gap-3">
              <p className="text-sm text-gray-400">Select a template or create a new one</p>
              <div className="flex gap-2">
                <button
                  onClick={() => openCreate("task")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  + Task template
                </button>
                <button
                  onClick={() => openCreate("event")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  + Event template
                </button>
              </div>
            </div>
          )}

          {/* Detail view */}
          {view.mode === "detail" && (() => {
            const t = view.template;
            const isTask = t.type === "task";
            const td = isTask ? (t.data as TaskTemplateData) : null;
            const ed = !isTask ? (t.data as EventTemplateData) : null;

            return (
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-black dark:text-white">{t.name}</h2>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${
                      isTask ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                    }`}>
                      {isTask ? "Task" : "Event"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(t)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    {confirmDelete === t.id ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { onDelete(t.id); setView({ mode: "list" }); setConfirmDelete(null); }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(t.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Task template detail */}
                {isTask && td && (
                  <div className="space-y-3 mb-6">
                    <p className="text-sm font-medium text-black dark:text-white">{td.title}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-black/50 dark:text-gray-400">
                      {td.priority && td.priority !== "none" && (
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[td.priority]}`} />
                          {td.priority[0].toUpperCase() + td.priority.slice(1)}
                        </span>
                      )}
                      {td.estimated_time && (
                        <span>{td.estimated_time < 60 ? `${td.estimated_time}m` : `${Math.floor(td.estimated_time / 60)}h${td.estimated_time % 60 > 0 ? ` ${td.estimated_time % 60}m` : ""}`} est.</span>
                      )}
                      {td.start_time && <span>{td.start_time}{td.end_time ? `–${td.end_time}` : ""}</span>}
                    </div>
                    {td.notes && <p className="text-xs text-gray-400 italic border-l-2 border-black/10 dark:border-white/10 pl-3">{td.notes}</p>}
                    {(td.subtasks ?? []).length > 0 && (
                      <div className="space-y-1">
                        {(td.subtasks ?? []).map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-black/50 dark:text-gray-400">
                            <span className="w-1 h-1 rounded-full bg-black/20 dark:bg-white/20 flex-shrink-0" />
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Event template detail */}
                {!isTask && ed && (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2">
                      {ed.color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ed.color }} />}
                      <p className="text-sm font-medium text-black dark:text-white">{ed.title}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-black/50 dark:text-gray-400">
                      {ed.start_time && <span>{ed.start_time}{ed.end_time ? `–${ed.end_time}` : ""}</span>}
                    </div>
                    {ed.description && <p className="text-xs text-gray-400 italic border-l-2 border-black/10 dark:border-white/10 pl-3">{ed.description}</p>}
                    {ed.tasks.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{ed.tasks.length} task{ed.tasks.length !== 1 ? "s" : ""}</p>
                        {ed.tasks.map((task, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-black/60 dark:text-gray-400">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority ?? "none"]}`} />
                            <span className="flex-1">{task.title}</span>
                            {task.estimated_time && (
                              <span className="text-black/30 dark:text-gray-600">
                                {task.estimated_time < 60 ? `${task.estimated_time}m` : `${Math.floor(task.estimated_time / 60)}h`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Apply */}
                {!isTask && showApplyDate ? (
                  <div className="flex items-center gap-3">
                    <input type="date" value={applyDate} onChange={(e) => setApplyDate(e.target.value)} className={INPUT} />
                    <button
                      onClick={() => handleApplyEvent(t)}
                      disabled={!applyDate}
                      className="text-sm px-4 py-1.5 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-30"
                    >
                      Create
                    </button>
                    <button onClick={() => setShowApplyDate(false)} className="text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleApply(t)}
                    className="text-sm px-5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity"
                  >
                    {isTask ? "Apply template" : "Apply → pick date"}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Form view */}
          {view.mode === "form" && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => setView({ mode: "list" })}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <h2 className="text-base font-semibold text-black dark:text-white">
                  {view.editing ? "Edit template" : `New ${view.templateType} template`}
                </h2>
              </div>

              <div className="space-y-5">
                {/* Template name */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Template name</p>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Morning Review"
                    className={`w-full text-sm ${INPUT}`}
                    autoFocus
                  />
                </div>

                {view.templateType === "task" ? (
                  /* ── Task template form ── */
                  <>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Default title</p>
                      <input
                        type="text"
                        value={taskDraft.title}
                        onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="Task title..."
                        className={`w-full text-sm ${INPUT}`}
                      />
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Priority</p>
                      <div className="flex gap-2 flex-wrap">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            onClick={() => setTaskDraft((d) => ({ ...d, priority: p }))}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                              taskDraft.priority === p
                                ? "border-black/30 dark:border-white/30 bg-black/5 dark:bg-white/10 text-black dark:text-white"
                                : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[p]}`} />
                            {p[0].toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Estimated time</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="minutes"
                          value={taskDraft.estimated_time}
                          onChange={(e) => setTaskDraft((d) => ({ ...d, estimated_time: e.target.value }))}
                          className={`w-28 ${INPUT}`}
                        />
                        {taskEstLabel && <span className="text-xs text-black/40 dark:text-gray-500">{taskEstLabel}</span>}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Default time</p>
                      <div className="flex items-center gap-2">
                        <input type="time" value={taskDraft.start_time} onChange={(e) => setTaskDraft((d) => ({ ...d, start_time: e.target.value }))} className={INPUT} />
                        {taskDraft.start_time && (
                          <input type="time" value={taskDraft.end_time} onChange={(e) => setTaskDraft((d) => ({ ...d, end_time: e.target.value }))} className={INPUT} />
                        )}
                      </div>
                    </div>

                    {lists.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">List</p>
                        <select
                          value={taskDraft.list_id}
                          onChange={(e) => setTaskDraft((d) => ({ ...d, list_id: e.target.value }))}
                          className={`${INPUT} cursor-pointer`}
                        >
                          <option value="">No list</option>
                          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Notes</p>
                      <textarea
                        value={taskDraft.notes}
                        onChange={(e) => setTaskDraft((d) => ({ ...d, notes: e.target.value }))}
                        placeholder="Default notes..."
                        rows={2}
                        className={`w-full ${INPUT} resize-none`}
                      />
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Subtasks</p>
                      <div className="space-y-1 mb-2">
                        {taskDraft.subtasks.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-black/20 dark:bg-white/20 flex-shrink-0" />
                            <span className="flex-1 text-xs text-black dark:text-white">{s}</span>
                            <button
                              onClick={() => setTaskDraft((d) => ({ ...d, subtasks: d.subtasks.filter((_, j) => j !== i) }))}
                              className="text-gray-400 hover:text-red-400 transition-colors"
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
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubToTask(); } }}
                          placeholder="Add subtask..."
                          className={`flex-1 ${INPUT}`}
                        />
                        <button onClick={addSubToTask} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ── Event template form ── */
                  <>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Event title</p>
                      <input
                        type="text"
                        value={eventDraft.title}
                        onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="Event title..."
                        className={`w-full text-sm ${INPUT}`}
                      />
                    </div>

                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Description</p>
                      <textarea
                        value={eventDraft.description}
                        onChange={(e) => setEventDraft((d) => ({ ...d, description: e.target.value }))}
                        placeholder="Description..."
                        rows={2}
                        className={`w-full ${INPUT} resize-none`}
                      />
                    </div>

                    <div className="flex items-end gap-5">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Color</p>
                        <input
                          type="color"
                          value={eventDraft.color || "#6366f1"}
                          onChange={(e) => setEventDraft((d) => ({ ...d, color: e.target.value }))}
                          className="w-9 h-9 rounded-lg cursor-pointer border border-black/10 dark:border-white/10 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">Default time</p>
                        <div className="flex items-center gap-2">
                          <input type="time" value={eventDraft.start_time} onChange={(e) => setEventDraft((d) => ({ ...d, start_time: e.target.value }))} className={INPUT} />
                          {eventDraft.start_time && (
                            <input type="time" value={eventDraft.end_time} onChange={(e) => setEventDraft((d) => ({ ...d, end_time: e.target.value }))} className={INPUT} />
                          )}
                        </div>
                      </div>
                    </div>

                    {lists.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 font-medium">List</p>
                        <select
                          value={eventDraft.list_id}
                          onChange={(e) => setEventDraft((d) => ({ ...d, list_id: e.target.value }))}
                          className={`${INPUT} cursor-pointer`}
                        >
                          <option value="">No list</option>
                          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 font-medium">Tasks</p>
                      <div className="space-y-2">
                        {eventDraft.tasks.map((task, i) => (
                          <TaskForm
                            key={i}
                            index={i}
                            draft={task}
                            lists={lists}
                            onChange={(updated) =>
                              setEventDraft((d) => ({
                                ...d,
                                tasks: d.tasks.map((t, j) => j === i ? updated : t),
                              }))
                            }
                            onRemove={() =>
                              setEventDraft((d) => ({
                                ...d,
                                tasks: d.tasks.filter((_, j) => j !== i),
                              }))
                            }
                          />
                        ))}
                        <button
                          onClick={() => setEventDraft((d) => ({ ...d, tasks: [...d.tasks, emptyTask()] }))}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                        >
                          <Plus size={12} />
                          Add task
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Save / Cancel */}
                <div className="flex gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={handleSave}
                    disabled={
                      !templateName.trim() ||
                      (view.templateType === "task" ? !taskDraft.title.trim() : !eventDraft.title.trim())
                    }
                    className="text-sm px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-30"
                  >
                    {view.editing ? "Save changes" : "Create template"}
                  </button>
                  <button
                    onClick={() => setView({ mode: "list" })}
                    className="text-sm px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
