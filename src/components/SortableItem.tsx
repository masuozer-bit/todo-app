"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo, Tag } from "@/lib/types";
import TodoItem from "./TodoItem";

interface SortableItemProps {
  todo: Todo;
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
}

export default function SortableItem({
  todo,
  allTags,
  onToggle,
  onUpdate,
  onDelete,
  onTagToggle,
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
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}
