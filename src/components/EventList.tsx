"use client";

import type { Event, List } from "@/lib/types";
import EventCard from "./EventCard";

interface EventListProps {
  events: Event[];
  lists: List[];
  loading: boolean;
  onUpdate: (id: string, updates: { title?: string; description?: string | null; list_id?: string | null; color?: string }) => void;
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
}

export default function EventList({
  events,
  lists,
  loading,
  onUpdate,
  onDelete,
  onAddTask,
  onRemoveTask,
  onToggleTodo,
}: EventListProps) {
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

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          lists={lists}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddTask={onAddTask}
          onRemoveTask={onRemoveTask}
          onToggleTodo={onToggleTodo}
        />
      ))}
    </div>
  );
}
