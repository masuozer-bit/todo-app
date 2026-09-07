"use client";

import { useMemo } from "react";
import { useI18n } from "./I18nProvider";
import { CheckCircle2, TrendingUp, Target } from "lucide-react";
import type { Todo } from "@/lib/types";

interface ProductivityStatsProps {
  todos: Todo[];
}

export default function ProductivityStats({ todos }: ProductivityStatsProps) {
  const { t } = useI18n();
  const stats = useMemo(() => {
    const now = new Date();
    const todayStr =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");

    const dayOfWeek = now.getDay();
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

    const completedToday = todos.filter((t) => {
      if (!t.completed) return false;
      if (t.updated_at) return t.updated_at.startsWith(todayStr);
      return false;
    }).length;

    const completedThisWeek = todos.filter((t) => {
      if (!t.completed) return false;
      if (t.updated_at) return t.updated_at >= mondayStr;
      return false;
    }).length;

    const totalActive = todos.filter((t) => !t.completed).length;

    return { completedToday, completedThisWeek, totalActive };
  }, [todos]);

  if (stats.totalActive === 0 && stats.completedToday === 0 && stats.completedThisWeek === 0) return null;

  return (
    <div className="flex items-center justify-around px-1 py-0.5">
      <div className="flex items-center gap-1" title={t("Done today")}>
        <Target size={10} className="text-green-500/60" />
        <span className="text-[11px] tabular-nums text-black/30 dark:text-white/25">{stats.completedToday}</span>
      </div>
      <div className="flex items-center gap-1" title={t("Done this week")}>
        <TrendingUp size={10} className="text-blue-500/60" />
        <span className="text-[11px] tabular-nums text-black/30 dark:text-white/25">{stats.completedThisWeek}</span>
      </div>
      <div className="flex items-center gap-1" title={t("Active")}>
        <CheckCircle2 size={10} className="text-white/20" />
        <span className="text-[11px] tabular-nums text-black/30 dark:text-white/25">{stats.totalActive}</span>
      </div>
    </div>
  );
}
