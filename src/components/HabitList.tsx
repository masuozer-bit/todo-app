"use client";

import { useState } from "react";
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
import type { HabitWithStatus, Habit, HabitCompletion, ScheduleType } from "@/lib/types";
import HabitItem from "./HabitItem";
import ConfirmDialog from "./ConfirmDialog";

function SortableHabitItem({
  habit,
  completions,
  onToggle,
  onUpdate,
  onDelete,
  highlighted,
}: {
  habit: HabitWithStatus;
  completions: HabitCompletion[];
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
    }
  ) => void;
  onDelete: (id: string) => void;
  onReorder: (reordered: Habit[]) => void;
  loading: boolean;
  highlightedHabitId?: string | null;
}

export default function HabitList({
  habits,
  completions = [],
  onToggle,
  onUpdate,
  onDelete,
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
          <div key={i} className="glass-card-subtle p-3 md:p-4 animate-pulse">
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

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete habit"
        message={`Are you sure you want to delete "${deleteTitle}"? This will also remove all completion history.`}
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
