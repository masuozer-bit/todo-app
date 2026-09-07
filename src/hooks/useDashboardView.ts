"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

export type ViewKind =
  | "all"
  | "today"
  | "week"
  | "overdue"
  | "events"
  | "habits"
  | "rules";

const VIEW_KINDS: ViewKind[] = ["all", "today", "week", "overdue", "events", "habits", "rules"];

export interface DashboardView {
  kind: ViewKind;
  listId: string | null;
  folderId: string | null;
  eventId: string | null;
  /** The task open in the detail panel. Shareable, and the back button works. */
  taskId: string | null;
  dates: string[];
}

const DEFAULT_VIEW: ViewKind = "today";

function buildQuery(view: DashboardView): string {
  const params = new URLSearchParams();
  if (view.kind !== DEFAULT_VIEW) params.set("view", view.kind);
  if (view.listId) params.set("list", view.listId);
  if (view.folderId) params.set("folder", view.folderId);
  if (view.eventId) params.set("event", view.eventId);
  if (view.taskId) params.set("task", view.taskId);
  if (view.dates.length > 0) params.set("dates", view.dates.join(","));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * The dashboard view lives in the URL, so the back button, a reload and a
 * shared link all land where the user expects. Navigation uses the History
 * API directly, which Next syncs with useSearchParams — no server roundtrip
 * for switching views.
 */
export function useDashboardView() {
  const searchParams = useSearchParams();

  // A stored default view applies when the URL says nothing
  useEffect(() => {
    if (searchParams.get("view")) return;
    if (searchParams.get("list") || searchParams.get("folder") || searchParams.get("dates")) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem("defaultView"); } catch { /* ignore */ }
    if (!stored || stored === DEFAULT_VIEW) return;
    if (!VIEW_KINDS.includes(stored as ViewKind)) return;
    window.history.replaceState(null, "", `${window.location.pathname}?view=${stored}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = useMemo<DashboardView>(() => {
    const raw = searchParams.get("view");
    const listId = searchParams.get("list");
    const folderId = searchParams.get("folder");
    const eventId = searchParams.get("event");
    const taskId = searchParams.get("task");
    const dates = (searchParams.get("dates") ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

    let kind: ViewKind = VIEW_KINDS.includes(raw as ViewKind)
      ? (raw as ViewKind)
      : DEFAULT_VIEW;
    // A list, folder or date selection means the unfiltered task view
    if (!raw && (listId || folderId || dates.length > 0)) kind = "all";

    return {
      kind,
      listId: kind === "all" ? listId : null,
      folderId: kind === "all" ? folderId : null,
      eventId: kind === "events" ? eventId : null,
      taskId,
      dates: kind === "all" ? dates : [],
    };
  }, [searchParams]);

  const navigate = useCallback(
    (next: Partial<DashboardView>) => {
      const target: DashboardView = {
        kind: next.kind ?? view.kind,
        listId: next.listId !== undefined ? next.listId : view.listId,
        folderId: next.folderId !== undefined ? next.folderId : view.folderId,
        eventId: next.eventId !== undefined ? next.eventId : view.eventId,
        taskId: next.taskId !== undefined ? next.taskId : view.taskId,
        dates: next.dates !== undefined ? next.dates : view.dates,
      };
      // Changing view closes the panel: the selected task is rarely in the new list
      if (next.kind !== undefined && next.kind !== view.kind && next.taskId === undefined) {
        target.taskId = null;
      }
      // Switching away from the task views drops their filters
      if (target.kind !== "all") {
        target.listId = null;
        target.folderId = null;
        target.dates = [];
      }
      if (target.kind !== "events") target.eventId = null;

      const url = `${window.location.pathname}${buildQuery(target)}`;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      window.history.pushState(null, "", url);
    },
    [view]
  );

  /* Replace instead of push — for state the user did not navigate to */
  const replaceView = useCallback((next: Partial<DashboardView>) => {
    const target: DashboardView = {
      kind: next.kind ?? view.kind,
      listId: next.listId !== undefined ? next.listId : view.listId,
      folderId: next.folderId !== undefined ? next.folderId : view.folderId,
      eventId: next.eventId !== undefined ? next.eventId : view.eventId,
      taskId: next.taskId !== undefined ? next.taskId : view.taskId,
      dates: next.dates !== undefined ? next.dates : view.dates,
    };
    const url = `${window.location.pathname}${buildQuery(target)}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    window.history.replaceState(null, "", url);
  }, [view]);

  return { view, navigate, replaceView };
}
