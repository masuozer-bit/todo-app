"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toDateStr } from "@/lib/date-helpers";
import { isScheduledForDate } from "@/lib/habit-schedule";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import type {
  Habit,
  HabitCompletion,
  HabitSkip,
  HabitOccurrence,
  HabitWithStatus,
  ScheduleType,
} from "@/lib/types";
import { syncHabitToCalendar } from "@/lib/calendar-sync-client";

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [skips, setSkips] = useState<HabitSkip[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { showError } = useToast();
  const habitsRef = useRef(habits);
  habitsRef.current = habits;
  const completionsRef = useRef(completions);
  completionsRef.current = completions;

  const fetchHabits = useCallback(async () => {
    if (!userId) return;

    // Last 30 days of completions are enough for the streak calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const todayStr = getTodayStr();

    // All three in parallel — they do not depend on each other
    const [habitsRes, completionsRes, skipsRes] = await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("habit_completions")
        .select("id, habit_id, completed_date")
        .eq("user_id", userId)
        .gte("completed_date", toDateStr(thirtyDaysAgo)),
      supabase
        .from("habit_skips")
        .select("*")
        .eq("user_id", userId)
        .eq("skip_date", todayStr),
    ]);

    if (habitsRes.data) setHabits(habitsRes.data);
    if (completionsRes.data) setCompletions(completionsRes.data as HabitCompletion[]);
    if (skipsRes.data) setSkips(skipsRes.data);
    setLoading(false);
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

  const skippedTodaySet = new Set(
    skips.filter((s) => s.skip_date === todayStr).map((s) => s.habit_id)
  );

  const todaysHabits: HabitWithStatus[] = habitsWithStatus.filter(
    (h) => isScheduledForDate(h, new Date()) && !skippedTodaySet.has(h.id)
  );

  /**
   * The habits that belong to the given days, one entry per habit and day.
   * A habit skipped on a day does not appear on that day.
   */
  const habitsForDates = useCallback(
    (dates: string[]): HabitOccurrence[] => {
      const skipped = new Set(skips.map((s) => `${s.habit_id}:${s.skip_date}`));
      const out: HabitOccurrence[] = [];
      for (const date of dates) {
        const day = new Date(`${date}T00:00:00`);
        if (Number.isNaN(day.getTime())) continue;
        for (const habit of habitsWithStatus) {
          if (!isScheduledForDate(habit, day)) continue;
          if (skipped.has(`${habit.id}:${date}`)) continue;
          out.push({
            ...habit,
            date,
            done: completionSet.has(`${habit.id}:${date}`),
          });
        }
      }
      return out;
    },
    // completionSet and habitsWithStatus are rebuilt on every render from
    // these two, so depending on the sources keeps the identity honest
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habits, completions, skips]
  );

  const addHabit = useCallback(
    async (
      title: string,
      scheduleType: ScheduleType,
      scheduleDays: number[],
      scheduleInterval: number,
      time?: string | null,
      notes?: string | null,
      end_time?: string | null,
      list_id?: string | null
    ) => {
      if (!userId) return;
      const maxOrder =
        habits.length > 0 ? Math.max(...habits.map((h) => h.sort_order)) : 0;
      const { data, error } = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          title,
          schedule_type: scheduleType,
          schedule_days: scheduleDays,
          schedule_interval: scheduleInterval,
          sort_order: maxOrder + 1,
          time: time || null,
          end_time: end_time || null,
          notes: notes || null,
          list_id: list_id || null,
        })
        .select()
        .single();
      if (error || !data) {
        showError("Habit could not be created");
        return;
      }
      {
        setHabits((prev) => [...prev, data]);
        // Calendar sync (fire-and-forget)
        syncHabitToCalendar("create", data.id, {
          title,
          schedule_type: scheduleType,
          schedule_days: scheduleDays,
          schedule_interval: scheduleInterval,
          created_at: data.created_at,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, habits.length, showError]
  );

  const updateHabit = useCallback(
    async (
      id: string,
      updates: {
        title?: string;
        schedule_type?: ScheduleType;
        schedule_days?: number[];
        schedule_interval?: number;
        time?: string | null;
        end_time?: string | null;
        notes?: string | null;
        list_id?: string | null;
      }
    ) => {
      const previous = habitsRef.current;

      setHabits((prev) =>
        prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
      );

      const { error } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", id);
      if (error) {
        setHabits(previous);
        showError("Habit could not be saved");
      } else {
        // Calendar sync (fire-and-forget)
        const habit = previous.find((h) => h.id === id);
        if (habit) {
          const merged = { ...habit, ...updates };
          syncHabitToCalendar("update", id, {
            title: merged.title,
            schedule_type: merged.schedule_type,
            schedule_days: merged.schedule_days,
            schedule_interval: merged.schedule_interval || 1,
            created_at: merged.created_at,
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      const previousHabits = habitsRef.current;
      const previousCompletions = completionsRef.current;

      setHabits((prev) => prev.filter((h) => h.id !== id));
      setCompletions((prev) => prev.filter((c) => c.habit_id !== id));

      // Sync calendar BEFORE deleting from DB (cascade may remove sync record)
      await syncHabitToCalendar("delete", id);
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) {
        setHabits(previousHabits);
        setCompletions(previousCompletions);
        showError("Habit could not be deleted");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  const toggleCompletion = useCallback(
    /** Without a date this means today, which is what every old caller meant. */
    async (habitId: string, date?: string) => {
      if (!userId) return;
      const today = date ?? getTodayStr();
      const existing = completions.find(
        (c) => c.habit_id === habitId && c.completed_date === today
      );

      if (existing) {
        setCompletions((prev) => prev.filter((c) => c.id !== existing.id));
        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("id", existing.id);
        if (error) {
          setCompletions((prev) => [...prev, existing]);
          showError("Habit could not be updated");
        }
      } else {
        const optimistic = {
          id: `temp-${Math.random().toString(36).slice(2)}`,
          habit_id: habitId,
          user_id: userId,
          completed_date: today,
          created_at: new Date().toISOString(),
        };
        setCompletions((prev) => [...prev, optimistic]);

        const { data, error } = await supabase
          .from("habit_completions")
          .insert({
            habit_id: habitId,
            user_id: userId,
            completed_date: today,
          })
          .select()
          .single();
        if (error || !data) {
          setCompletions((prev) => prev.filter((c) => c.id !== optimistic.id));
          showError("Habit could not be marked as done");
        } else {
          setCompletions((prev) => prev.map((c) => (c.id === optimistic.id ? data : c)));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, completions, showError]
  );

  const skipHabitForDate = useCallback(
    async (habitId: string, date?: string) => {
      if (!userId) return;
      const skipDate = date || getTodayStr();
      // Optimistic update — hide immediately
      const optimisticSkip = {
        id: `temp-${Date.now()}`,
        habit_id: habitId,
        user_id: userId,
        skip_date: skipDate,
        created_at: new Date().toISOString(),
      };
      setSkips((prev) => [...prev, optimisticSkip]);

      const { data, error } = await supabase
        .from("habit_skips")
        .insert({
          habit_id: habitId,
          user_id: userId,
          skip_date: skipDate,
        })
        .select()
        .single();
      if (error) {
        // Revert optimistic update
        setSkips((prev) => prev.filter((s) => s.id !== optimisticSkip.id));
        showError("Habit could not be skipped");
      } else if (data) {
        // Replace optimistic entry with real one
        setSkips((prev) =>
          prev.map((s) => (s.id === optimisticSkip.id ? data : s))
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, showError]
  );

  const reorderHabits = useCallback(
    async (reordered: Habit[]) => {
      const previous = habitsRef.current;
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
      const { error } = await supabase.from("habits").upsert(updates);
      if (error) {
        setHabits(previous);
        showError("New order could not be saved");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showError]
  );

  return {
    habits: habitsWithStatus,
    todaysHabits,
    habitsForDates,
    completions,
    loading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    skipHabitForDate,
    reorderHabits,
  };
}
