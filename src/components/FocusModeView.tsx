"use client";

import { useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import TodoList from "./TodoList";
import TodoInput from "./TodoInput";
import type { Todo, Tag, List, Event, Priority } from "@/lib/types";

interface FocusModeViewProps {
  todayTodos: Todo[];
  thisWeekTodos: Todo[];
  loading: boolean;
  allTags: Tag[];
  lists: List[];
  events: Event[];
  onAdd: (
    title: string,
    tagIds: string[],
    options?: {
      due_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      priority?: Priority;
      notes?: string | null;
      list_id?: string | null;
    }
  ) => void;
  onToggle: (id: string, completed: boolean) => void;
  onUpdate: (
    id: string,
    updates: {
      title?: string;
      due_date?: string | null;
      start_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      priority?: Priority;
      notes?: string | null;
      list_id?: string | null;
    }
  ) => void;
  onDelete: (id: string) => void;
  onTagToggle: (todoId: string, tagId: string, add: boolean) => void;
  onReorder: (reordered: Todo[]) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (todoId: string, subtaskId: string, completed: boolean) => void;
  onDeleteSubtask: (todoId: string, subtaskId: string) => void;
  onAssignEvent?: (todoId: string, eventId: string | null) => void;
  onDeleteEvent?: (eventId: string) => void;
  onOpenEventDetail?: (eventId: string) => void;
  onExitFocusMode: () => void;
}

const SLIDE_LABELS = ["Today", "This Week"] as const;

export default function FocusModeView({
  todayTodos,
  thisWeekTodos,
  loading,
  allTags,
  lists,
  events,
  onAdd,
  onToggle,
  onUpdate,
  onDelete,
  onTagToggle,
  onReorder,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAssignEvent,
  onDeleteEvent,
  onOpenEventDetail,
  onExitFocusMode,
}: FocusModeViewProps) {
  const [slide, setSlide] = useState<0 | 1>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const isDragging = useRef(false);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    isDragging.current = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;
    touchCurrentX.current = e.touches[0].clientX;
    const delta = touchCurrentX.current - touchStartX.current;
    // Rubber-band at edges
    if ((slide === 0 && delta > 0) || (slide === 1 && delta < 0)) {
      setDragOffset(delta * 0.2); // heavy resistance at edge
    } else {
      setDragOffset(delta * 0.6); // light resistance mid-swipe
    }
  }

  function handleTouchEnd() {
    isDragging.current = false;
    const delta = touchCurrentX.current - touchStartX.current;
    const THRESHOLD = 60;
    if (delta < -THRESHOLD && slide === 0) setSlide(1);
    else if (delta > THRESHOLD && slide === 1) setSlide(0);
    setDragOffset(0);
  }

  const translateX = `calc(${-slide * 50}% + ${dragOffset * 0.5}px)`;
  const isAnimating = dragOffset === 0;

  const sharedHandlers = {
    onToggle,
    onUpdate,
    onDelete,
    onTagToggle,
    onReorder,
    onAddSubtask,
    onToggleSubtask,
    onDeleteSubtask,
    onAssignEvent,
    onDeleteEvent,
    onOpenEventDetail,
  };

  return (
    <div className="md:hidden fixed inset-0 z-[80] bg-white dark:bg-black flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-12 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
              {dateLabel}
            </p>
            <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">
              {SLIDE_LABELS[slide]}
            </h1>
          </div>
          <button
            onClick={onExitFocusMode}
            className="mt-1 p-2 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
            aria-label="Exit focus mode"
          >
            <LayoutGrid size={18} />
          </button>
        </div>

        {/* Task input */}
        <div className="mt-4">
          <TodoInput
            onAdd={onAdd}
            tags={allTags}
            lists={lists}
            activeListId={null}
          />
        </div>
      </div>

      {/* ── Swipeable panels ── */}
      <div
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex h-full"
          style={{
            width: "200%",
            transform: `translateX(${translateX})`,
            transition: isAnimating ? "transform 300ms ease-out" : "none",
            willChange: "transform",
          }}
        >
          {/* Panel 0: Today */}
          <div
            className="overflow-y-auto px-4 pb-24"
            style={{ width: "50%" }}
          >
            <TodoList
              todos={todayTodos}
              allTags={allTags}
              loading={loading}
              lists={lists}
              events={events}
              defaultSortBy="timeline"
              viewKey="focus:today"
              {...sharedHandlers}
            />
          </div>

          {/* Panel 1: This Week */}
          <div
            className="overflow-y-auto px-4 pb-24"
            style={{ width: "50%" }}
          >
            <TodoList
              todos={thisWeekTodos}
              allTags={allTags}
              loading={loading}
              lists={lists}
              events={events}
              defaultSortBy="timeline"
              viewKey="focus:thisWeek"
              {...sharedHandlers}
            />
          </div>
        </div>
      </div>

      {/* ── Page dots ── */}
      <div className="flex-shrink-0 flex justify-center items-center gap-2 pb-8 pt-3">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            aria-label={SLIDE_LABELS[i]}
            style={{
              width: slide === i ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                slide === i
                  ? "currentColor"
                  : undefined,
              transition: "all 300ms ease",
            }}
            className={
              slide === i
                ? "text-black dark:text-white"
                : "bg-black/15 dark:bg-white/20"
            }
          />
        ))}
      </div>
    </div>
  );
}
