"use client";

import { useEffect, useRef } from "react";
import { X, Inbox, Repeat, List, Plus } from "lucide-react";
import type { List as ListType, Todo } from "@/lib/types";
import TagManager from "./TagManager";
import ProductivityStats from "./ProductivityStats";
import type { Tag } from "@/lib/types";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  lists: ListType[];
  activeListId: string | null;
  habitsView: boolean;
  onSwitchToAll: () => void;
  onSwitchToHabits: () => void;
  onSwitchToList: (listId: string) => void;
  onAddList: () => void;
  tags: Tag[];
  onAddTag: (name: string) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
  todos: Todo[];
}

export default function MobileSidebar({
  open,
  onClose,
  lists,
  activeListId,
  habitsView,
  onSwitchToAll,
  onSwitchToHabits,
  onSwitchToList,
  onAddList,
  tags,
  onAddTag,
  onDeleteTag,
  todos,
}: MobileSidebarProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function handleNav(fn: () => void) {
    fn();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`md:hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-[95] w-72 bg-white dark:bg-neutral-950 border-r border-black/10 dark:border-white/10 shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-3">
            <h2 className="text-base font-semibold text-black dark:text-white">
              Menu
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
            {/* All Tasks */}
            <button
              onClick={() => handleNav(onSwitchToAll)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default ${
                !activeListId && !habitsView
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Inbox size={16} />
              All Tasks
            </button>

            {/* Habits */}
            <button
              onClick={() => handleNav(onSwitchToHabits)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default ${
                habitsView
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Repeat size={16} />
              Habits
            </button>

            {/* Lists */}
            {lists.length > 0 && (
              <div className="mt-4 mb-2">
                <p className="text-xs font-medium text-gray-400 px-3 mb-2 uppercase tracking-wide">
                  Lists
                </p>
                {lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleNav(() => onSwitchToList(list.id))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default mb-0.5 ${
                      activeListId === list.id
                        ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                        : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <List size={15} />
                    <span className="truncate">{list.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* New list */}
            <button
              onClick={() => {
                onAddList();
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default w-full rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Plus size={14} />
              New list
            </button>

            {/* Tags */}
            <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5">
              <TagManager tags={tags} onAdd={onAddTag} onDelete={onDeleteTag} />
            </div>

            {/* Stats */}
            <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5">
              <ProductivityStats todos={todos} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
