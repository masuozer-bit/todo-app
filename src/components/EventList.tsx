"use client";

import { useState, useMemo, useEffect } from "react";
import type { Event, List, Tag, Priority } from "@/lib/types";
import EventCard from "./EventCard";
import EventDetail from "./EventDetail";
import { GripVertical, List as ListIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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

interface SharedEventCardProps {
  lists: List[];
  allTags: Tag[];
  events: Event[];
  onUpdate: (id: string, updates: { title?: string; description?: string | null; list_id?: string | null; color?: string; due_date?: string | null; end_date?: string | null }) => void;
  onDelete: (id: string) => void;
  onAddTask: (
    eventId: string,
    title: string,
    options?: { due_date?: string | null; start_time?: string | null; priority?: string; list_id?: string | null }
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
  onOpenDetail?: (id: string) => void;
}

interface EventListProps extends SharedEventCardProps {
  loading: boolean;
  defaultSelectedEventId?: string | null;
  onDefaultEventHandled?: () => void;
  onReorderEvents?: (orderedIds: string[]) => void;
}

type SortMode = "manual" | "list";

function SortableEventItem({ event, ...props }: { event: Event } & SharedEventCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative pl-6 ${isDragging ? "opacity-50 z-10" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="absolute left-0 top-3 text-gray-300 dark:text-gray-700 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none p-0.5"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <EventCard event={event} {...props} />
    </div>
  );
}

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
  defaultSelectedEventId,
  onDefaultEventHandled,
  onReorderEvents,
}: EventListProps) {
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("eventSortMode") as SortMode) ?? "list";
  });
  const [manualOrder, setManualOrder] = useState<string[]>(() => events.map(e => e.id));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Open a specific event detail when triggered from outside (e.g. list view)
  useEffect(() => {
    if (defaultSelectedEventId) {
      setSelectedEventId(defaultSelectedEventId);
      onDefaultEventHandled?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSelectedEventId]);

  // Keep manual order in sync only when the set of event IDs changes
  // (add/delete), not on sort_order changes (which would overwrite drag order).
  const eventIdsKey = events.map(e => e.id).sort().join(",");
  useEffect(() => {
    setManualOrder(prev => {
      const currentIds = events.map(e => e.id);
      const kept = prev.filter(id => currentIds.includes(id));
      const added = currentIds.filter(id => !kept.includes(id));
      return [...kept, ...added];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdsKey]);

  // Auto-back if the selected event was deleted
  useEffect(() => {
    if (selectedEventId && !events.find(e => e.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [events, selectedEventId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = manualOrder.indexOf(String(active.id));
    const newIdx = manualOrder.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(manualOrder, oldIdx, newIdx);
    setManualOrder(next);
    onReorderEvents?.(next);
  }

  const displayedEvents = useMemo(() => {
    const map = new Map(events.map(e => [e.id, e]));
    return manualOrder.map(id => map.get(id)).filter((e): e is Event => e !== undefined);
  }, [events, manualOrder]);

  // Grouped by list for the "by list" view
  const listGroups = useMemo(() => {
    if (sortMode !== "list") return [];
    const groups: { listId: string | null; listName: string; events: Event[] }[] = [];
    const seen = new Map<string | null, number>();

    for (const event of events) {
      const key = event.list_id ?? null;
      const name = key ? (lists.find(l => l.id === key)?.name ?? "Unknown") : "No List";
      if (!seen.has(key)) {
        seen.set(key, groups.length);
        groups.push({ listId: key, listName: name, events: [] });
      }
      groups[seen.get(key)!].events.push(event);
    }

    // Sort groups: named lists alphabetically, "No List" last
    groups.sort((a, b) => {
      if (!a.listId && !b.listId) return 0;
      if (!a.listId) return 1;
      if (!b.listId) return -1;
      return a.listName.localeCompare(b.listName);
    });

    return groups;
  }, [events, lists, sortMode]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card-subtle p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────
  const selectedEvent = selectedEventId
    ? events.find(e => e.id === selectedEventId)
    : null;

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        lists={lists}
        allTags={allTags}
        events={events}
        onBack={() => setSelectedEventId(null)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAddTask={onAddTask}
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
    );
  }

  // ── List view ─────────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">
          No events yet — create one to group related tasks together
        </p>
      </div>
    );
  }

  const sharedProps: SharedEventCardProps = {
    lists, allTags, events, onUpdate, onDelete, onAddTask, onRemoveTask,
    onToggleTodo, onUpdateTodo, onDeleteTodo, onTagToggle, onAddSubtask,
    onToggleSubtask, onDeleteSubtask, onAssignEvent, onRefetchEvents,
    onOpenDetail: (id) => setSelectedEventId(id),
  };

  return (
    <div className="space-y-3">
      {/* Sort mode toggle */}
      <div className="flex items-center gap-1.5 mb-1">
        <button
          onClick={() => { setSortMode("manual"); localStorage.setItem("eventSortMode", "manual"); }}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-default ${
            sortMode === "manual"
              ? "bg-black dark:bg-white text-white dark:text-black border-transparent font-medium"
              : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20 hover:text-black dark:hover:text-white"
          }`}
        >
          <GripVertical size={12} />
          Manual
        </button>
        <button
          onClick={() => { setSortMode("list"); localStorage.setItem("eventSortMode", "list"); }}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-default ${
            sortMode === "list"
              ? "bg-black dark:bg-white text-white dark:text-black border-transparent font-medium"
              : "border-black/10 dark:border-white/10 text-gray-400 hover:border-black/20 dark:hover:border-white/20 hover:text-black dark:hover:text-white"
          }`}
        >
          <ListIcon size={12} />
          By List
        </button>
      </div>

      {sortMode === "manual" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayedEvents.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {displayedEvents.map(event => (
                <SortableEventItem key={event.id} event={event} {...sharedProps} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        /* ── By List: grouped sections with headers ── */
        <div className="space-y-6">
          {listGroups.map(group => (
            <div key={group.listId ?? "__none__"}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {group.listName}
                </p>
                <span className="text-xs text-gray-300 dark:text-gray-600">
                  {group.events.length}
                </span>
                <div className="flex-1 h-px bg-black/5 dark:bg-white/5" />
              </div>
              {/* Events in this group */}
              <div className="space-y-3">
                {group.events.map(event => (
                  <EventCard key={event.id} event={event} {...sharedProps} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
