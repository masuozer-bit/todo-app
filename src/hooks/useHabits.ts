"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Habit,
  HabitCompletion,
  HabitWithStatus,
  ScheduleType,
} from "@/lib/types";

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isScheduledForDate(habit: Habit, date: Date): boolean {
  if (habit.schedule_type === "weekly") {
    return habit.schedule_days.includes(date.getDay());
  }
  // interval: every X days from created_at
  const interval = habit.schedule_interval || 1;
  if (interval === 1) return true; // every day
  const start = new Date(habit.created_at);
  start.setHours(0, 0, 0, 0);
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  const diffMs = check.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays % interval === 0;
}

function calculateStreak(
  habit: Habit,
  completionSet: Set<string>,
  todayStr: string
): number {
  const completedToday = completionSet.has(`${habit.id}:${todayStr}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(today);

  if (!completedToday) {
    if (isScheduledForDate(habit, checkDate)) return 0;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dateStr = toDateStr(checkDate);
    if (isScheduledForDate(habit, checkDate)) {
      if (completionSet.has(`${habit.id}:${dateStr}`)) {
        streak++;
      } else {
        break;
      }
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

export function useHabits(userId: string | undefined) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchHabits = useCallback(async () => {
    if (!userId) return;

    const { data: habitsData } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });

    if (habitsData) setHabits(habitsData);

    // Fetch last 30 days of completions for streak calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: completionsData } = await supabase
      .from("habit_completions")
      .select("*")
      .eq("user_id", userId)
      .gte("completed_date", toDateStr(thirtyDaysAgo));

    if (completionsData) setCompletions(completionsData);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  // Build a fast lookup set: "habitId:YYYY-MM-DD"
  const completionSet = new Set(
    completions.map((c) => `${c.habit_id}:${c.completed_date}`)
  );
  const todayStr = getTodayStr();

  const habitsWithStatus: HabitWithStatus[] = habits.map((habit) => ({
    ...habit,
    completedToday: completionSet.has(`${habit.id}:${todayStr}`),
    streak: calculateStreak(habit, completionSet, todayStr),
  }));

  const todaysHabits: HabitWithStatus[] = habitsWithStatus.filter((h) =>
    isScheduledForDate(h, new Date())
  );

  const addHabit = useCallback(
    async (
      title: string,
      scheduleType: ScheduleType,
      scheduleDays: number[],
      scheduleInterval: number
    ) => {
      if (!userId) return;
      const maxOrder =
        habits.length > 0 ? Math.max(...habits.map((h) => h.sort_order)) : 0;
      const { data } = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          title,
          schedule_type: scheduleType,
          schedule_days: scheduleDays,
          schedule_interval: scheduleInterval,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      if (data) setHabits((prev) => [...prev, data]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, habits.length]
  );

  const updateHabit = useCallback(
    async (
      id: string,
      updates: {
        title?: string;
        schedule_type?: ScheduleType;
        schedule_days?: number[];
        schedule_interval?: number;
      }
    ) => {
      const { error } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", id);
      if (!error) {
        setHabits((prev) =>
          prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (!error) {
        setHabits((prev) => prev.filter((h) => h.id !== id));
        setCompletions((prev) => prev.filter((c) => c.habit_id !== id));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const toggleCompletion = useCallback(
    async (habitId: string) => {
      if (!userId) return;
      const today = getTodayStr();
      const existing = completions.find(
        (c) => c.habit_id === habitId && c.completed_date === today
      );

      if (existing) {
        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("id", existing.id);
        if (!error) {
          setCompletions((prev) => prev.filter((c) => c.id !== existing.id));
        }
      } else {
        const { data, error } = await supabase
          .from("habit_completions")
          .insert({
            habit_id: habitId,
            user_id: userId,
            completed_date: today,
          })
          .select()
          .single();
        if (!error && data) {
          setCompletions((prev) => [...prev, data]);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, completions]
  );

  const reorderHabits = useCallback(
    async (reordered: Habit[]) => {
      setHabits(reordered);
      const updates = reordered.map((h, i) => ({
        id: h.id,
        user_id: h.user_id,
        title: h.title,
        schedule_type: h.schedule_type,
        schedule_days: h.schedule_days,
        schedule_interval: h.schedule_interval || 1,
        sort_order: i,
      }));
      await supabase.from("habits").upsert(updates);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    habits: habitsWithStatus,
    todaysHabits,
    loading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    reorderHabits,
  };
}
