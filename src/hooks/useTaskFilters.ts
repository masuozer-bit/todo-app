"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type FilterStatus = "all" | "active" | "completed";
export type SortBy = "default" | "priority" | "timeline" | "alpha";

/**
 * Search, filter, sort and bulk select for the task list. It lives here
 * because the content header owns the controls and the list owns the rows;
 * both need the same state.
 */
export function useTaskFilters(viewKey: string, defaultSortBy: SortBy = "default") {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [tagId, setTagId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>(defaultSortBy);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Switching view starts clean; a filter from another list only confuses
  useEffect(() => {
    setSearch("");
    setStatus("all");
    setTagId(null);
    setSortBy(defaultSortBy);
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [viewKey, defaultSortBy]);

  const clear = useCallback(() => {
    setSearch("");
    setStatus("all");
    setTagId(null);
    setSortBy(defaultSortBy);
  }, [defaultSortBy]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  const active = useMemo(
    () => search.trim() !== "" || status !== "all" || tagId !== null || sortBy !== defaultSortBy,
    [search, status, tagId, sortBy, defaultSortBy]
  );

  return {
    /** What this view sorts by when nothing was chosen. Not a filter. */
    defaultSortBy,
    search, setSearch,
    status, setStatus,
    tagId, setTagId,
    sortBy, setSortBy,
    selectMode, setSelectMode,
    selectedIds, toggleSelected, clearSelection,
    active, clear,
  };
}

export type TaskFilters = ReturnType<typeof useTaskFilters>;
