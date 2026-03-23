"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Edit2, Check, X } from "lucide-react";
import type { Rule } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";

const CATEGORY_PALETTE = [
  "bg-emerald-500/20 text-emerald-400",
  "bg-violet-500/20 text-violet-400",
  "bg-orange-500/20 text-orange-400",
  "bg-sky-500/20 text-sky-400",
  "bg-yellow-500/20 text-yellow-400",
  "bg-pink-500/20 text-pink-400",
  "bg-teal-500/20 text-teal-400",
  "bg-rose-500/20 text-rose-400",
];

function getCategoryColor(category: string, allCategories: string[]): string {
  const idx = allCategories.indexOf(category);
  return CATEGORY_PALETTE[idx >= 0 ? idx % CATEGORY_PALETTE.length : 0];
}

/* ─── Sortable Rule Item ─── */

function SortableRuleItem({
  rule,
  onUpdate,
  onDelete,
  allCategories,
}: {
  rule: Rule;
  onUpdate: (id: string, updates: Partial<Pick<Rule, "title" | "description" | "category">>) => void;
  onDelete: (id: string) => void;
  allCategories: string[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(rule.title);
  const [editDesc, setEditDesc] = useState(rule.description || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function save() {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    onUpdate(rule.id, { title: trimmed, description: editDesc.trim() || null });
    setEditing(false);
  }

  function cancel() {
    setEditTitle(rule.title);
    setEditDesc(rule.description || "");
    setEditing(false);
  }

  const catStyle = rule.category ? getCategoryColor(rule.category, allCategories) : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group bg-white dark:bg-black rounded-xl px-3 py-3 flex items-start gap-2.5 transition-default ${isDragging ? "opacity-40 scale-[0.98]" : ""}`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing transition-default opacity-0 group-hover:opacity-100"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>

        {/* Rule number */}
        <span className="mt-0.5 text-[10px] font-bold text-black/20 dark:text-gray-600 tabular-nums w-4 text-right flex-shrink-0">
          {rule.sort_order + 1}.
        </span>

        {editing ? (
          <div className="flex-1 space-y-1.5">
            <input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              className="w-full bg-transparent outline-none text-sm text-black dark:text-white font-medium"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Why this rule matters..."
              rows={2}
              className="w-full bg-transparent outline-none text-xs text-black/60 dark:text-gray-400 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
            />
            <div className="flex gap-1.5">
              <button onClick={save} className="text-emerald-500 hover:text-emerald-400 transition-default"><Check size={14} /></button>
              <button onClick={cancel} className="text-gray-400 hover:text-gray-300 transition-default"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-black dark:text-white leading-snug">{rule.title}</span>
              {catStyle && (
                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${catStyle}`}>
                  {rule.category}
                </span>
              )}
            </div>
            {rule.description && (
              <p className="text-[11px] text-black/40 dark:text-gray-500 mt-0.5 leading-relaxed">{rule.description}</p>
            )}
          </div>
        )}

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-default flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white transition-default"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-400 dark:text-gray-500 hover:text-red-400 transition-default"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete rule"
        message={`Delete "${rule.title}"?`}
        onConfirm={() => { onDelete(rule.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

/* ─── Main RuleList ─── */

interface RuleListProps {
  rules: Rule[];
  loading: boolean;
  onUpdate: (id: string, updates: Partial<Pick<Rule, "title" | "description" | "category">>) => void;
  onDelete: (id: string) => void;
  onReorder: (reordered: Rule[]) => void;
}

export default function RuleList({ rules, loading, onUpdate, onDelete, onReorder }: RuleListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [filterCat, setFilterCat] = useState<string | null>(null);

  const categories = Array.from(new Set(rules.filter(r => r.category).map(r => r.category!)));
  const displayed = filterCat ? rules.filter(r => r.category === filterCat) : rules;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rules.findIndex(r => r.id === active.id);
    const newIndex = rules.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(rules, oldIndex, newIndex).map((r, i) => ({ ...r, sort_order: i }));
    onReorder(reordered);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-black rounded-xl h-14 animate-pulse" />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-black/30 dark:text-gray-600">No rules yet</p>
        <p className="text-xs text-black/20 dark:text-gray-700 mt-1">Add rules you want to live by</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category filter pills */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCat(null)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-default border ${
              !filterCat
                ? "bg-black/10 dark:bg-white/10 border-black/15 dark:border-white/15 text-black dark:text-white"
                : "border-transparent text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white"
            }`}
          >
            All ({rules.length})
          </button>
          {categories.map(cat => {
            const catStyle = getCategoryColor(cat, categories);
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-default border ${
                  filterCat === cat
                    ? `${catStyle} border-current/20`
                    : "border-transparent text-black/40 dark:text-gray-500 hover:text-black dark:hover:text-white"
                }`}
              >
                {cat} ({rules.filter(r => r.category === cat).length})
              </button>
            );
          })}
        </div>
      )}

      {/* Rules list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayed.map(r => r.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {displayed.map(rule => (
              <SortableRuleItem
                key={rule.id}
                rule={rule}
                onUpdate={onUpdate}
                onDelete={onDelete}
                allCategories={categories}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
