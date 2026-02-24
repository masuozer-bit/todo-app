"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo, Tag, Priority } from "@/lib/types";
import TodoItem from "./TodoItem";

interface SortableItemProps {
  todo: Todo;
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, updates: { title?: string; due_date?: string | null; priority?: Priority; notes?: string | null }) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
}

export default function SortableItem({
  todo,
  allTags,
  onToggle,
  onUpdate,
  onDelete,
  onTagToggle,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TodoItem
        todo={todo}
        allTags={allTags}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onTagToggle={onTagToggle}
        onAddSubtask={onAddSubtask}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}
