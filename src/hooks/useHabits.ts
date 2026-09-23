"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toDateStr } from "@/lib/date-helpers";
import { isScheduledForDate } from "@/lib/habit-schedule";
import { HISTORY_DAYS, fullDays, habitStats } from "@/lib/habit-stats";
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


/* PostgREST hands out at most this many rows per request */
const PAGE = 1000;

/** Every row of a query, page by page, so a long history is not cut off. */
async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    // A failed first page keeps what is on screen; a later one keeps what came
    if (error || !data) return from === 0 ? null : rows;
    rows.push(...(data as T[]));
    if (data.length < PAGE) return rows;
  }
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

    // A year of history: enough for the streaks, the rates and the history
    // grid in the panel. Skips are loaded as far back, because a skipped day
    // is a rest and must not read as a missed one.
    const since = new Date();
    since.setDate(since.getDate() - (HISTORY_DAYS - 1));
    const sinceStr = toDateStr(since);

    // All three in parallel, they do not depend on each other
    const [habitsRes, completionRows, skipRows] = await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
      fetchAllPages<HabitCompletion>((from, to) =>
        supabase
          .from("habit_completions")
          .select("id, habit_id, completed_date")
          .eq("user_id", userId)
          .gte("completed_date", sinceStr)
          .order("completed_date", { ascending: false })
          .order("id")
          .range(from, to)
      ),
      fetchAllPages<HabitSkip>((from, to) =>
        supabase
          .from("habit_skips")
          .select("*")
          .eq("user_id", userId)
          .gte("skip_date", sinceStr)
          .order("skip_date", { ascending: false })
          .order("id")
          .range(from, to)
      ),
    ]);

    if (habitsRes.data) setHabits(habitsRes.data);
    if (completionRows) setCompletions(completionRows);
    if (skipRows) setSkips(skipRows);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const todayStr = getTodayStr();

  // Fast lookups: "habitId:YYYY-MM-DD", and every habit's days as a set
  const { completionSet, doneByHabit, skippedByHabit } = useMemo(() => {
    const completionSet = new Set<string>();
    const doneByHabit = new Map<string, Set<string>>();
    for (const c of completions) {
      completionSet.add(`${c.habit_id}:${c.completed_date}`);
      let set = doneByHabit.get(c.habit_id);
      if (!set) doneByHabit.set(c.habit_id, (set = new Set()));
      set.add(c.completed_date);
    }
    const skippedByHabit = new Map<string, Set<string>>();
    for (const s of skips) {
      let set = skippedByHabit.get(s.habit_id);
      if (!set) skippedByHabit.set(s.habit_id, (set = new Set()));
      set.add(s.skip_date);
    }
    return { completionSet, doneByHabit, skippedByHabit };
  }, [completions, skips]);

  const habitsWithStatus: HabitWithStatus[] = useMemo(() => {
    const now = new Date(`${todayStr}T00:00:00`);
    const none = new Set<string>();
    return habits.map((habit) => {
      const done = doneByHabit.get(habit.id) ?? none;
      const skipped = skippedByHabit.get(habit.id) ?? none;
      const skippedToday = skipped.has(todayStr);
      return {
        ...habit,
        completedToday: done.has(todayStr),
        dueToday: isScheduledForDate(habit, now) && !skippedToday,
        skippedToday,
        ...habitStats(habit, done, skipped, now),
      };
    });
  }, [habits, doneByHabit, skippedByHabit, todayStr]);

  // Days in a row with every due habit done, over all habits together
  const fullDayRun = useMemo(() => {
    const none = new Set<string>();
    return fullDays(
      habits,
      (i) => doneByHabit.get(habits[i].id) ?? none,
      (i) => skippedByHabit.get(habits[i].id) ?? none,
      new Date(`${todayStr}T00:00:00`)
    );
  }, [habits, doneByHabit, skippedByHabit, todayStr]);

  const todaysHabits: HabitWithStatus[] = useMemo(
    () => habitsWithStatus.filter((h) => h.dueToday),
    [habitsWithStatus]
  );

  /**
   * The habits that belong to the given days, one entry per habit and day.
   * A habit skipped on a day does not appear on that day.
   */
  const habitsForDates = useCallback(
    (dates: string[]): HabitOccurrence[] => {
      const out: HabitOccurrence[] = [];
      for (const date of dates) {
        const day = new Date(`${date}T00:00:00`);
        if (Number.isNaN(day.getTime())) continue;
        for (const habit of habitsWithStatus) {
          if (!isScheduledForDate(habit, day)) continue;
          if (skippedByHabit.get(habit.id)?.has(date)) continue;
          out.push({
            ...habit,
            date,
            done: completionSet.has(`${habit.id}:${date}`),
          });
        }
      }
      return out;
    },
    [habitsWithStatus, skippedByHabit, completionSet]
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
    fullDayRun,
    habitsForDates,
    completions,
    skips,
    loading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    skipHabitForDate,
    reorderHabits,
  };
}
