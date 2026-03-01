"use client";

import { useMemo } from "react";
import { CheckCircle2, TrendingUp, Target, Flame } from "lucide-react";
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
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Stats
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={11} className="text-green-500" />
            <span className="text-[10px] text-gray-400 uppercase">Today</span>
          </div>
          <p className="text-lg font-semibold text-black dark:text-white leading-none">
            {stats.completedToday}
          </p>
        </div>

        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={11} className="text-blue-500" />
            <span className="text-[10px] text-gray-400 uppercase">Week</span>
          </div>
          <p className="text-lg font-semibold text-black dark:text-white leading-none">
            {stats.completedThisWeek}
          </p>
        </div>

        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={11} className="text-gray-400" />
            <span className="text-[10px] text-gray-400 uppercase">Active</span>
          </div>
          <p className="text-lg font-semibold text-black dark:text-white leading-none">
            {stats.totalActive}
          </p>
        </div>

        {stats.overdue > 0 && (
          <div className="rounded-xl bg-red-50/50 dark:bg-red-950/20 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={11} className="text-red-500" />
              <span className="text-[10px] text-red-500/80 uppercase">Overdue</span>
            </div>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400 leading-none">
              {stats.overdue}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
