"use client";

import { useState, useMemo } from "react";
import type { Event, List, Tag, Priority } from "@/lib/types";
import EventCard from "./EventCard";
import { ArrowUpDown } from "lucide-react";

interface EventListProps {
  events: Event[];
  lists: List[];
  allTags: Tag[];
  loading: boolean;
  onUpdate: (id: string, updates: { title?: string; description?: string | null; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null }) => void;
  onDelete: (id: string) => void;
  onAddTask: (
    eventId: string,
    title: string,
    options?: {
      due_date?: string | null;
      start_time?: string | null;
      priority?: string;
      list_id?: string | null;
    }
  ) => void;
  onRemoveTask: (eventId: string, todoId: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onUpdateTodo: (id: string, updates: { title?: string; due_date?: string | null; start_time?: string | null; end_time?: string | null; priority?: Priority; notes?: string | null; list_id?: string | null }) => void;
  onDeleteTodo: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  onAssignEvent: (todoId: string, eventId: string | null) => void;
  onRefetchEvents?: () => void;
}

type SortOption = "default" | "title" | "due_date";

export default function EventList({
  events,
  lists,
  allTags,
  loading,
  onUpdate,
  onDelete,
  onAddTask,
  onRemoveTask,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onTagToggle,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAssignEvent,
  onRefetchEvents,
}: EventListProps) {
  const [sortBy, setSortBy] = useState<SortOption>("default");

  const sortedEvents = useMemo(() => {
    if (sortBy === "title") {
      return [...events].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === "due_date") {
      return [...events].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    }
    return events;
  }, [events, sortBy]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="glass-card-subtle p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">
          No events yet — create one to group related tasks together
        </p>
      </div>
    );
  }

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "default", label: "Default" },
    { value: "title", label: "Title" },
    { value: "due_date", label: "Due date" },
  ];

  return (
    <div className="space-y-3">
      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-1">
        <ArrowUpDown size={13} className="text-gray-400 flex-shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-default ${
                sortBy === opt.value
                  ? "bg-black dark:bg-white text-white dark:text-black border-transparent font-medium"
                  : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20 hover:text-black dark:hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sortedEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          lists={lists}
          allTags={allTags}
          events={events}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddTask={onAddTask}
          onRemoveTask={onRemoveTask}
          onToggleTodo={onToggleTodo}
          onUpdateTodo={onUpdateTodo}
          onDeleteTodo={onDeleteTodo}
          onTagToggle={onTagToggle}
          onAddSubtask={onAddSubtask}
          onToggleSubtask={onToggleSubtask}
          onDeleteSubtask={onDeleteSubtask}
          onAssignEvent={onAssignEvent}
          onRefetchEvents={onRefetchEvents}
        />
      ))}
    </div>
  );
}
