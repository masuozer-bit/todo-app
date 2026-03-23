"use client";

import { useMemo } from "react";
import { Clock, Target, TrendingUp, BarChart3 } from "lucide-react";
import type { Todo, List } from "@/lib/types";

interface TimeStatsProps {
  todos: Todo[];
  lists: List[];
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getWeekStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TimeStats({ todos, lists }: TimeStatsProps) {
  const stats = useMemo(() => {
    const weekStart = getWeekStart();
    const listMap = new Map(lists.map(l => [l.id, l]));

    let totalAll = 0;
    let totalWeek = 0;
    let estimatedTotal = 0;
    let actualOfEstimated = 0;
    let tasksWithBoth = 0;

    const byListAll = new Map<string, number>();
    const byListWeek = new Map<string, number>();

    for (const t of todos) {
      const spent = t.time_spent ?? 0;
      if (spent === 0) continue;

      totalAll += spent;

      // Check if updated this week
      const updatedDate = t.updated_at?.slice(0, 10) ?? "";
      if (updatedDate >= weekStart) {
        totalWeek += spent;
        const lid = t.list_id ?? "__none";
        byListWeek.set(lid, (byListWeek.get(lid) ?? 0) + spent);
      }

      const lid = t.list_id ?? "__none";
      byListAll.set(lid, (byListAll.get(lid) ?? 0) + spent);

      // Accuracy tracking
      if (t.estimated_time && t.estimated_time > 0) {
        estimatedTotal += t.estimated_time * 60;
        actualOfEstimated += spent;
        tasksWithBoth++;
      }
    }

    // Accuracy score: how close actual is to estimated (100% = perfect)
    // Score formula: 100 - |actual - estimated| / estimated * 100, clamped 0-100
    let accuracyScore: number | null = null;
    if (tasksWithBoth > 0 && estimatedTotal > 0) {
      const deviation = Math.abs(actualOfEstimated - estimatedTotal) / estimatedTotal;
      accuracyScore = Math.round(Math.max(0, (1 - deviation) * 100));
    }

    // Build list breakdown arrays
    const listBreakdownAll = Array.from(byListAll.entries())
      .map(([lid, secs]) => ({
        name: lid === "__none" ? "No List" : listMap.get(lid)?.name ?? "Unknown",
        color: lid === "__none" ? null : listMap.get(lid)?.color ?? null,
        seconds: secs,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const listBreakdownWeek = Array.from(byListWeek.entries())
      .map(([lid, secs]) => ({
        name: lid === "__none" ? "No List" : listMap.get(lid)?.name ?? "Unknown",
        color: lid === "__none" ? null : listMap.get(lid)?.color ?? null,
        seconds: secs,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    return {
      totalAll,
      totalWeek,
      accuracyScore,
      tasksWithBoth,
      estimatedTotal,
      actualOfEstimated,
      listBreakdownAll,
      listBreakdownWeek,
    };
  }, [todos, lists]);

  const hasData = stats.totalAll > 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={<Clock size={14} />}
          label="This Week"
          value={formatDuration(stats.totalWeek)}
          accent="text-blue-400"
        />
        <StatCard
          icon={<BarChart3 size={14} />}
          label="All Time"
          value={formatDuration(stats.totalAll)}
          accent="text-emerald-400"
        />
        {stats.accuracyScore !== null && (
          <>
            <StatCard
              icon={<Target size={14} />}
              label="Accuracy"
              value={`${stats.accuracyScore}%`}
              accent={stats.accuracyScore >= 80 ? "text-emerald-400" : stats.accuracyScore >= 50 ? "text-amber-400" : "text-red-400"}
            />
            <StatCard
              icon={<TrendingUp size={14} />}
              label="Tasks Tracked"
              value={`${stats.tasksWithBoth}`}
              accent="text-violet-400"
            />
          </>
        )}
      </div>

      {/* Accuracy bar */}
      {stats.accuracyScore !== null && (
        <div className="rounded-xl bg-white dark:bg-black px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Estimation Accuracy</span>
            <span className="text-[10px] text-gray-500 tabular-nums">
              {formatDuration(stats.actualOfEstimated)} / {formatDuration(stats.estimatedTotal)} estimated
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                stats.accuracyScore >= 80 ? "bg-emerald-500" : stats.accuracyScore >= 50 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(stats.accuracyScore, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            {stats.accuracyScore >= 80 ? "Great self-assessment!" : stats.accuracyScore >= 50 ? "Room for improvement" : "Try more realistic estimates"}
          </p>
        </div>
      )}

      {/* This week per list */}
      {stats.listBreakdownWeek.length > 0 && (
        <ListBreakdown title="This Week by List" items={stats.listBreakdownWeek} max={stats.totalWeek} />
      )}

      {/* All time per list */}
      {stats.listBreakdownAll.length > 0 && (
        <ListBreakdown title="All Time by List" items={stats.listBreakdownAll} max={stats.totalAll} />
      )}

      {!hasData && (
        <div className="text-center py-6">
          <Clock size={20} className="mx-auto text-gray-600 mb-2" />
          <p className="text-xs text-gray-500">No time tracked yet</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Click the play button on a task to start</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-white dark:bg-black px-3 py-2.5">
      <div className={`flex items-center gap-1.5 mb-1 ${accent}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold text-black dark:text-white tabular-nums">{value}</p>
    </div>
  );
}

function ListBreakdown({ title, items, max }: { title: string; items: { name: string; color: string | null; seconds: number }[]; max: number }) {
  return (
    <div className="rounded-xl bg-white dark:bg-black px-3 py-2.5">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-black dark:text-white flex items-center gap-1.5">
                {item.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />}
                {item.name}
              </span>
              <span className="text-[10px] text-gray-500 tabular-nums">{formatDuration(item.seconds)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${max > 0 ? (item.seconds / max) * 100 : 0}%`,
                  backgroundColor: item.color ?? "rgba(120,120,120,0.5)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
