"use client";

import { useMemo } from "react";
import { CheckCircle2, TrendingUp, Target } from "lucide-react";
import type { Todo } from "@/lib/types";

interface ProductivityStatsProps {
  todos: Todo[];
}

export default function ProductivityStats({ todos }: ProductivityStatsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");

    // Start of week (Monday)
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const mondayStr =
      monday.getFullYear() +
      "-" +
      String(monday.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(monday.getDate()).padStart(2, "0");

    // We use updated_at as a proxy for completion time
    const completedToday = todos.filter((t) => {
      if (!t.completed) return false;
      // If updated_at is today, count it
      if (t.updated_at) {
        return t.updated_at.startsWith(todayStr);
      }
      return false;
    }).length;

    const completedThisWeek = todos.filter((t) => {
      if (!t.completed) return false;
      if (t.updated_at) {
        return t.updated_at >= mondayStr;
      }
      return false;
    }).length;

    const totalActive = todos.filter((t) => !t.completed).length;
    const totalCompleted = todos.filter((t) => t.completed).length;

    // Overdue tasks
    const overdue = todos.filter((t) => {
      if (t.completed || !t.due_date) return false;
      return t.due_date < todayStr;
    }).length;

    return { completedToday, completedThisWeek, totalActive, totalCompleted, overdue };
  }, [todos]);

  // Don't render if no data at all
  if (stats.totalActive === 0 && stats.totalCompleted === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-300 dark:text-gray-700 uppercase tracking-widest mb-2">
        Stats
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Target size={11} className="text-green-500" />
            Done today
          </span>
          <span className="text-xs font-semibold text-black dark:text-white tabular-nums">
            {stats.completedToday}
          </span>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <TrendingUp size={11} className="text-blue-500" />
            Done this week
          </span>
          <span className="text-xs font-semibold text-black dark:text-white tabular-nums">
            {stats.completedThisWeek}
          </span>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <CheckCircle2 size={11} className="text-gray-400" />
            Active
          </span>
          <span className="text-xs font-semibold text-black dark:text-white tabular-nums">
            {stats.totalActive}
          </span>
        </div>
      </div>
    </div>
  );
}
