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
} from "@dnd-kit/sortable";
import type { Todo, Tag } from "@/lib/types";
import SortableItem from "./SortableItem";
import TodoItem from "./TodoItem";
import ConfirmDialog from "./ConfirmDialog";

interface TodoListProps {
  todos: Todo[];
  allTags: Tag[];
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onReorder: (reordered: Todo[]) => void;
  loading: boolean;
}

export default function TodoList({
  todos,
  allTags,
  onToggle,
  onUpdate,
  onDelete,
  onTagToggle,
  onReorder,
  loading,
}: TodoListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteTitle =
    todos.find((t) => t.id === deleteId)?.title ?? "this task";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(todos, oldIndex, newIndex);
    onReorder(reordered);
  }

  function handleDeleteRequest(id: string) {
    setDeleteId(id);
  }

  function handleDeleteConfirm() {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-gray-400/30 border-t-black dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  return (
    <>
      {todos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-base">No tasks yet</p>
          <p className="text-gray-400/60 text-sm mt-1">
            Add one above to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Active todos (sortable) */}
          {activeTodos.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {activeTodos.map((todo) => (
                    <SortableItem
                      key={todo.id}
                      todo={todo}
                      allTags={allTags}
                      onToggle={onToggle}
                      onUpdate={onUpdate}
                      onDelete={handleDeleteRequest}
                      onTagToggle={onTagToggle}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Completed todos */}
          {completedTodos.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
                Completed ({completedTodos.length})
              </p>
              <div className="space-y-2">
                {completedTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    allTags={allTags}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDelete={handleDeleteRequest}
                    onTagToggle={onTagToggle}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete task"
        message={`Are you sure you want to delete "${deleteTitle}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
