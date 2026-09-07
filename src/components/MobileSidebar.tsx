"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { X, Inbox, Repeat, List, Plus, Sun, CalendarDays, CalendarRange, Shield, Check, Trash2 } from "lucide-react";
import type { List as ListType, Todo } from "@/lib/types";
import ProductivityStats from "./ProductivityStats";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  lists: ListType[];
  activeListId: string | null;
  habitsView: boolean;
  eventsView?: boolean;
  rulesView?: boolean;
  quickFilter?: "overdue" | "today" | "thisWeek" | null;
  onSwitchToAll: () => void;
  onSwitchToEvents?: () => void;
  onSwitchToHabits: () => void;
  onSwitchToRules?: () => void;
  onSwitchToList: (listId: string) => void;
  onSwitchToToday?: () => void;
  onSwitchToThisWeek?: () => void;
  onAddList: () => void;
  /** Create a list without leaving the phone */
  onCreateList?: (name: string) => void;
  onDeleteList?: (id: string) => void;
  todos: Todo[];
}

export default function MobileSidebar({
  open,
  onClose,
  lists,
  activeListId,
  habitsView,
  eventsView,
  rulesView,
  quickFilter,
  onSwitchToAll,
  onSwitchToEvents,
  onSwitchToHabits,
  onSwitchToRules,
  onSwitchToList,
  onSwitchToToday,
  onSwitchToThisWeek,
  onAddList,
  onCreateList,
  onDeleteList,
  todos,
}: MobileSidebarProps) {
  const { t } = useI18n();
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
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
        className={`md:hidden fixed inset-y-0 left-0 z-[95] w-72 border-r border-black/10 dark:border-white/10 transform transition-transform duration-300 ease-out [backdrop-filter:blur(40px)_saturate(2)] [-webkit-backdrop-filter:blur(40px)_saturate(2)] bg-white/85 dark:bg-[rgba(13,12,24,0.92)] shadow-[8px_0_32px_rgba(0,0,0,0.2)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-3">
            <h2 className="text-base font-semibold text-black dark:text-white">{t("Menu")}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-default"
              aria-label={t("Close menu")}
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
                !activeListId && !habitsView && !eventsView && !quickFilter
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Inbox size={16} />{t("All Tasks")}</button>

            {/* Today */}
            {onSwitchToToday && (
              <button
                onClick={() => handleNav(onSwitchToToday)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default ${
                  quickFilter === "today"
                    ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <Sun size={16} />{t("Today")}</button>
            )}

            {/* This Week */}
            {onSwitchToThisWeek && (
              <button
                onClick={() => handleNav(onSwitchToThisWeek)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default ${
                  quickFilter === "thisWeek"
                    ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <CalendarDays size={16} />{t("This Week")}</button>
            )}

            {/* Projects */}
            {onSwitchToEvents && (
              <button
                onClick={() => handleNav(onSwitchToEvents)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default ${
                  eventsView
                    ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <CalendarRange size={16} />{t("Projects")}</button>
            )}

            {/* Habits */}
            <button
              onClick={() => handleNav(onSwitchToHabits)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default ${
                habitsView
                  ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Repeat size={16} />{t("Habits")}</button>

            {/* Principles */}
            {onSwitchToRules && (
              <button
                onClick={() => handleNav(onSwitchToRules)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-default ${
                  rulesView
                    ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <Shield size={16} />{t("Principles")}</button>
            )}

            {/* Lists */}
            {lists.length > 0 && (
              <div className="mt-4 mb-2">
                <p className="text-xs font-medium text-gray-400 px-3 mb-2 uppercase tracking-wide">{t("Lists")}</p>
                {lists.map((list) => (
                  <div
                    key={list.id}
                    className={`flex items-center rounded-xl mb-0.5 ${
                      activeListId === list.id
                        ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <button
                      onClick={() => handleNav(() => onSwitchToList(list.id))}
                      className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 text-sm text-left"
                    >
                      {list.color && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: list.color }} />
                      )}
                      <List size={15} className="flex-shrink-0" />
                      <span className="truncate">{list.name}</span>
                    </button>
                    {onDeleteList && (
                      <button
                        onClick={() => onDeleteList(list.id)}
                        className="p-2.5 flex-shrink-0 opacity-60 hover:opacity-100 hover:text-red-500 transition-default"
                        aria-label={`Delete list ${list.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New list — the form lives here, not only on the desktop sidebar */}
            {onCreateList ? (
              showNewList ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = newListName.trim();
                    if (!name) return;
                    onCreateList(name);
                    setNewListName("");
                    setShowNewList(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") { setShowNewList(false); setNewListName(""); } }}
                    placeholder={t("List name...")}
                    className="flex-1 min-w-0 text-sm bg-transparent border-b border-black/20 dark:border-white/20 pb-1 text-black dark:text-white placeholder:text-gray-400 focus:outline-none"
                  />
                  <button type="submit" className="p-2 text-gray-400 hover:text-black dark:hover:text-white" aria-label={t("Create list")}>
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewList(false); setNewListName(""); }}
                    className="p-2 text-gray-400 hover:text-black dark:hover:text-white"
                    aria-label={t("Cancel")}
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowNewList(true)}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default w-full rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Plus size={14} />{t("New list")}</button>
              )
            ) : (
              <button
                onClick={() => {
                  onAddList();
                  onClose();
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-400 hover:text-black dark:hover:text-white transition-default w-full rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Plus size={14} />{t("New list")}</button>
            )}

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
