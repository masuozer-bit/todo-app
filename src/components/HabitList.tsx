"use client";

import { useState, useEffect, useRef } from "react";
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
import { X, CalendarOff, Trash2 } from "lucide-react";
import type { HabitWithStatus, Habit, HabitCompletion, ScheduleType, List } from "@/lib/types";
import HabitItem from "./HabitItem";

function SortableHabitItem({
  habit,
  completions,
  lists,
  onToggle,
  onUpdate,
  onDelete,
  highlighted,
}: {
  habit: HabitWithStatus;
  completions: HabitCompletion[];
  lists?: List[];
  onToggle: (id: string) => void;
  onUpdate: (
    id: string,
    updates: {
      title?: string;
      schedule_type?: ScheduleType;
      schedule_days?: number[];
      schedule_interval?: number;
      time?: string | null;
      end_time?: string | null;
      notes?: string | null;
      list_id?: string | null;
    }
  ) => void;
  onDelete: (id: string) => void;
  highlighted?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <HabitItem
        habit={habit}
        completions={completions}
        lists={lists}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        highlighted={highlighted}
      />
    </div>
  );
}

interface HabitListProps {
  habits: HabitWithStatus[];
  completions?: HabitCompletion[];
  lists?: List[];
  onToggle: (habitId: string) => void;
  onUpdate: (
    id: string,
    updates: {
      title?: string;
      schedule_type?: ScheduleType;
      schedule_days?: number[];
      schedule_interval?: number;
      time?: string | null;
      end_time?: string | null;
      notes?: string | null;
      list_id?: string | null;
    }
  ) => void;
  onDelete: (id: string) => void;
  onSkip: (habitId: string) => void;
  onReorder: (reordered: Habit[]) => void;
  loading: boolean;
  highlightedHabitId?: string | null;
}

export default function HabitList({
  habits,
  completions = [],
  lists = [],
  onToggle,
  onUpdate,
  onDelete,
  onSkip,
  onReorder,
  loading,
  highlightedHabitId,
}: HabitListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteTitle =
    habits.find((h) => h.id === deleteId)?.title ?? "this habit";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const completedCount = habits.filter((h) => h.completedToday).length;
  const totalCount = habits.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    const reordered = arrayMove(habits, oldIndex, newIndex);
    onReorder(reordered);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-black rounded-xl p-3 md:p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-md bg-black/10 dark:bg-white/10 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-black/10 dark:bg-white/10 rounded-lg w-2/3" />
                <div className="flex gap-2">
                  <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-16" />
                  <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-12" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">
              {completedCount}/{totalCount} completed today
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full">
            <div
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Habit items */}
      {habits.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-base">No habits yet</p>
          <p className="text-gray-400/60 text-sm mt-1">
            Add one above to build your routine
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={habits.map((h) => h.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {habits.map((habit) => (
                <SortableHabitItem
                  key={habit.id}
                  habit={habit}
                  completions={completions.filter((c) => c.habit_id === habit.id)}
                  lists={lists}
                  onToggle={onToggle}
                  onUpdate={onUpdate}
                  onDelete={(id) => setDeleteId(id)}
                  highlighted={highlightedHabitId === habit.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete choice dialog */}
      {deleteId !== null && (
        <HabitDeleteDialog
          title={deleteTitle}
          onSkipToday={() => {
            if (deleteId) {
              onSkip(deleteId);
              setDeleteId(null);
            }
          }}
          onDeleteAll={() => {
            if (deleteId) {
              onDelete(deleteId);
              setDeleteId(null);
            }
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  );
}

/* ─── Habit Delete Choice Dialog ─── */

function HabitDeleteDialog({
  title,
  onSkipToday,
  onDeleteAll,
  onCancel,
}: {
  title: string;
  onSkipToday: () => void;
  onDeleteAll: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-card p-6 w-full max-w-sm">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white transition-default"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold text-black dark:text-white mb-1">
          {title}
        </h2>
        <p className="text-sm text-gray-400 mb-5">What would you like to do?</p>

        <div className="space-y-2">
          <button
            onClick={onSkipToday}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-black text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-default group"
          >
            <CalendarOff size={16} className="text-orange-400 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-black dark:text-white block">Hide for today</span>
              <span className="text-[11px] text-gray-400">Remove from today only, returns next scheduled day</span>
            </div>
          </button>

          <button
            onClick={onDeleteAll}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-black text-left hover:bg-red-50 dark:hover:bg-red-950/20 transition-default group"
          >
            <Trash2 size={16} className="text-red-400 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-red-400 block">Delete forever</span>
              <span className="text-[11px] text-gray-400">Permanently remove habit and all history</span>
            </div>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white dark:bg-black text-sm font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-default"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
