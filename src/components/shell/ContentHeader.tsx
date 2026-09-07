"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpDown, CalendarDays, CheckSquare, Filter, MoreHorizontal, Search, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import Popover, { PopoverItem } from "@/components/ui/Popover";
import type { FilterStatus, SortBy, TaskFilters } from "@/hooks/useTaskFilters";
import type { Tag } from "@/lib/types";

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: "All",
  active: "Active",
  completed: "Completed",
};

const SORT_LABELS: Record<SortBy, string> = {
  default: "Manual",
  alpha: "A to Z",
  priority: "Priority",
  timeline: "Timeline",
};

interface ContentHeaderProps {
  title: string;
  /** Open tasks, shown next to the title. Hidden when undefined. */
  openCount?: number;
  /** A list colour dot, the "Today" progress ring, anything title-sized. */
  titleBefore?: ReactNode;
  titleAfter?: ReactNode;
  /** Only the task views carry filters; other views pass nothing. */
  filters?: TaskFilters;
  tags?: Tag[];
  /** Total tasks, so bulk select can hide itself on an empty list. */
  total?: number;
  calendarOpen?: boolean;
  onToggleCalendar?: () => void;
  /** Extra buttons, right of the standard set. */
  actions?: ReactNode;
  /** The phone shows a hamburger where the desktop shows nothing. */
  onOpenMenu?: () => void;
}

export default function ContentHeader({
  title,
  openCount,
  titleBefore,
  titleAfter,
  filters,
  tags = [],
  total = 0,
  calendarOpen = false,
  onToggleCalendar,
  actions,
  onOpenMenu,
}: ContentHeaderProps) {
  const { t } = useI18n();
  const searchRef = useRef<HTMLInputElement>(null);

  // M opens filter and sort, the same key the old panel used
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "m" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (document.querySelector('[aria-modal="true"], [role="dialog"]')) return;
      e.preventDefault();
      filterTriggerRef.current?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chips = filters ? buildChips(filters, tags, t) : [];

  return (
    <>
      <div className="app-col-head">
        {onOpenMenu && (
          <button onClick={onOpenMenu} className="icon-btn flex-none md:hidden" aria-label={t("Open menu")}>
            <Filter size={18} className="hidden" />
            <MenuIcon />
          </button>
        )}
        {titleBefore}
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <h1 className="text-xl font-semibold text-text truncate min-w-0">{title}</h1>
          {openCount !== undefined && (
            <span className="text-[13px] text-text-muted flex-none tabular-nums">
              {t("{n} open", { n: openCount })}
            </span>
          )}
        </div>
        {titleAfter}

        {filters && (
          <>
            <label className="hidden lg:flex items-center gap-1.5 h-8 px-2 rounded surface-2 border border-border focus-within:border-border-strong">
              <Search size={14} className="text-text-faint flex-none" />
              <input
                ref={searchRef}
                value={filters.search}
                onChange={(e) => filters.setSearch(e.target.value)}
                placeholder={t("Search tasks...")}
                aria-label={t("Search tasks")}
                data-search-input=""
                className="w-[180px] bg-transparent text-[13px] text-text placeholder:text-text-faint focus:outline-none"
              />
              {filters.search && (
                <button onClick={() => filters.setSearch("")} className="text-text-faint flex-none" aria-label={t("Clear")}>
                  <X size={14} />
                </button>
              )}
            </label>

            <Popover
              align="end"
              label={t("Filter")}
              trigger={(p) => (
                <button
                  ref={(el) => { p.ref(el); filterTriggerRef.current = el as HTMLButtonElement | null; }}
                  onClick={p.onClick}
                  aria-expanded={p["aria-expanded"]}
                  className={`icon-btn flex-none ${filters.active ? "icon-btn-on" : ""}`}
                  aria-label={t("Filter")}
                  title={`${t("Filter")}  M`}
                >
                  <Filter size={16} />
                </button>
              )}
            >
              {(close) => (
                <div className="min-w-[220px]">
                  <p className="px-2 pb-1 text-xs text-text-faint">{t("Status")}</p>
                  {(Object.keys(STATUS_LABELS) as FilterStatus[]).map((s) => (
                    <PopoverItem
                      key={s}
                      icon={<Tick on={filters.status === s} />}
                      onClick={() => { filters.setStatus(s); close(); }}
                    >
                      {t(STATUS_LABELS[s])}
                    </PopoverItem>
                  ))}
                  {tags.length > 0 && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <p className="px-2 pb-1 text-xs text-text-faint">{t("Tag")}</p>
                      <PopoverItem icon={<Tick on={filters.tagId === null} />} onClick={() => { filters.setTagId(null); close(); }}>
                        {t("All")}
                      </PopoverItem>
                      {tags.map((tag) => (
                        <PopoverItem
                          key={tag.id}
                          icon={<Tick on={filters.tagId === tag.id} />}
                          onClick={() => { filters.setTagId(filters.tagId === tag.id ? null : tag.id); close(); }}
                        >
                          {tag.name}
                        </PopoverItem>
                      ))}
                    </>
                  )}
                  {filters.active && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <PopoverItem icon={<X size={16} />} onClick={() => { filters.clear(); close(); }}>
                        {t("Clear all filters")}
                      </PopoverItem>
                    </>
                  )}
                </div>
              )}
            </Popover>

            <Popover
              align="end"
              label={t("Sort by")}
              trigger={(p) => (
                <button
                  ref={p.ref as (el: HTMLButtonElement | null) => void}
                  onClick={p.onClick}
                  aria-expanded={p["aria-expanded"]}
                  className="icon-btn flex-none hidden md:inline-flex"
                  aria-label={t("Sort by")}
                  title={t("Sort by")}
                >
                  <ArrowUpDown size={16} />
                </button>
              )}
            >
              {(close) => (
                <div className="min-w-[180px]">
                  {(Object.keys(SORT_LABELS) as SortBy[]).map((s) => (
                    <PopoverItem
                      key={s}
                      icon={<Tick on={filters.sortBy === s} />}
                      onClick={() => { filters.setSortBy(s); close(); }}
                    >
                      {t(SORT_LABELS[s])}
                    </PopoverItem>
                  ))}
                </div>
              )}
            </Popover>

            {total > 0 && (
              <button
                onClick={() => { if (filters.selectMode) filters.clearSelection(); else filters.setSelectMode(true); }}
                className={`icon-btn flex-none hidden md:inline-flex ${filters.selectMode ? "icon-btn-on" : ""}`}
                aria-label={filters.selectMode ? t("Cancel selection") : t("Select multiple")}
                title={filters.selectMode ? t("Cancel selection") : t("Select multiple")}
              >
                <CheckSquare size={16} />
              </button>
            )}
          </>
        )}

        {onToggleCalendar && (
          <button
            onClick={onToggleCalendar}
            className={`icon-btn flex-none hidden md:inline-flex ${calendarOpen ? "icon-btn-on" : ""}`}
            aria-label={t("Calendar")}
            title={`${t("Calendar")}  C`}
          >
            <CalendarDays size={16} />
          </button>
        )}
        {actions}

        {/* A phone head has room for a title, the filter and one more button.
            Sorting, multiple selection and the calendar move in here. */}
        {(filters || onToggleCalendar) && (
          <Popover
            align="end"
            label={t("More")}
            trigger={(p) => (
              <button
                ref={p.ref as (el: HTMLButtonElement | null) => void}
                onClick={p.onClick}
                aria-expanded={p["aria-expanded"]}
                className="icon-btn flex-none md:hidden"
                aria-label={t("More")}
              >
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            {(close) => (
              <div className="min-w-[200px]">
                {filters && (
                  <>
                    <p className="px-2 pb-1 text-xs text-text-faint">{t("Sort by")}</p>
                    {(Object.keys(SORT_LABELS) as SortBy[]).map((s) => (
                      <PopoverItem
                        key={s}
                        icon={<Tick on={filters.sortBy === s} />}
                        onClick={() => { filters.setSortBy(s); close(); }}
                      >
                        {t(SORT_LABELS[s])}
                      </PopoverItem>
                    ))}
                  </>
                )}
                {filters && total > 0 && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <PopoverItem
                      icon={<CheckSquare size={16} />}
                      onClick={() => {
                        if (filters.selectMode) filters.clearSelection();
                        else filters.setSelectMode(true);
                        close();
                      }}
                    >
                      {filters.selectMode ? t("Cancel selection") : t("Select multiple")}
                    </PopoverItem>
                  </>
                )}
                {onToggleCalendar && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <PopoverItem
                      icon={<CalendarDays size={16} />}
                      onClick={() => { onToggleCalendar(); close(); }}
                    >
                      {t("Calendar")}
                    </PopoverItem>
                  </>
                )}
              </div>
            )}
          </Popover>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex-none flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border">
          {chips.map((chip) => (
            <button key={chip.key} onClick={chip.onClear} className="chip">
              {chip.label}
              <X size={12} />
            </button>
          ))}
          <button onClick={filters!.clear} className="btn btn-ghost h-6 px-2 text-xs">
            {t("Clear all filters")}
          </button>
        </div>
      )}
    </>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className="w-4 flex-none flex items-center justify-center" aria-hidden="true">
      {on ? <span className="w-1.5 h-1.5 rounded-full block" style={{ background: "var(--accent)" }} /> : null}
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function buildChips(
  filters: TaskFilters,
  tags: Tag[],
  t: (key: string, params?: Record<string, string | number>) => string
) {
  const chips: { key: string; label: string; onClear: () => void }[] = [];
  if (filters.search.trim()) {
    chips.push({ key: "search", label: `${t("Search")}: ${filters.search}`, onClear: () => filters.setSearch("") });
  }
  if (filters.status !== "all") {
    chips.push({ key: "status", label: `${t("Status")}: ${t(STATUS_LABELS[filters.status])}`, onClear: () => filters.setStatus("all") });
  }
  if (filters.tagId) {
    const tag = tags.find((x) => x.id === filters.tagId);
    chips.push({ key: "tag", label: `${t("Tag")}: ${tag?.name ?? ""}`, onClear: () => filters.setTagId(null) });
  }
  // The sort a view starts with is not a choice the user made, so no chip
  if (filters.sortBy !== filters.defaultSortBy) {
    chips.push({
      key: "sort",
      label: `${t("Sort by")}: ${t(SORT_LABELS[filters.sortBy])}`,
      onClear: () => filters.setSortBy(filters.defaultSortBy),
    });
  }
  return chips;
}
