"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * Wraps any child with a drag handle for mixed (event + task) manual sort.
 * The grip stays faintly visible so it can be found without hovering, and it
 * is reachable by keyboard.
 */
export default function ManualSortWrapper({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-stretch gap-1 group/drag"
    >
      {/* Drag handle — left side, visible on hover */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-4 flex items-center justify-center opacity-25 group-hover/drag:opacity-60 focus-visible:opacity-100 hover:!opacity-100 [@media(hover:none)]:opacity-50 cursor-grab active:cursor-grabbing text-gray-400 transition-default"
        aria-label="Drag to reorder"
        tabIndex={0}
      >
        <GripVertical size={13} />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
