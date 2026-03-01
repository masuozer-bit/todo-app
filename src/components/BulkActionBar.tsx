"use client";

import { Check, Trash2, X, ArrowRight } from "lucide-react";
import type { List } from "@/lib/types";

interface BulkActionBarProps {
  selectedCount: number;
  onComplete: () => void;
  onDelete: () => void;
  onMoveToList?: (listId: string | null) => void;
  onCancel: () => void;
  lists?: List[];
}

export default function BulkActionBar({
  selectedCount,
  onComplete,
  onDelete,
  onMoveToList,
  onCancel,
  lists = [],
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black rounded-2xl px-4 py-2.5 shadow-2xl border border-white/10 dark:border-black/10">
        <span className="text-sm font-medium tabular-nums mr-1">
          {selectedCount} selected
        </span>

        <div className="w-px h-5 bg-white/20 dark:bg-black/20" />

        <button
          onClick={onComplete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl hover:bg-white/15 dark:hover:bg-black/10 transition-default"
          title="Complete selected"
        >
          <Check size={14} />
          <span className="hidden sm:inline">Done</span>
        </button>

        {lists.length > 0 && onMoveToList && (
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl hover:bg-white/15 dark:hover:bg-black/10 transition-default"
              title="Move to list"
            >
              <ArrowRight size={14} />
              <span className="hidden sm:inline">Move</span>
            </button>
            {/* Dropdown */}
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block min-w-[140px]">
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-black/10 dark:border-white/10 shadow-xl py-1 text-black dark:text-white">
                <button
                  onClick={() => onMoveToList(null)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-default text-gray-400"
                >
                  No list
                </button>
                {lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => onMoveToList(list.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition-default"
                  >
                    {list.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl hover:bg-red-500/30 dark:hover:bg-red-500/20 text-red-300 dark:text-red-500 transition-default"
          title="Delete selected"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>

        <div className="w-px h-5 bg-white/20 dark:bg-black/20" />

        <button
          onClick={onCancel}
          className="p-1.5 rounded-xl hover:bg-white/15 dark:hover:bg-black/10 transition-default"
          title="Cancel selection"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
