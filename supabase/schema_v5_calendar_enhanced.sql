-- ============================================
-- Schema V5 – Enhanced Calendar Sync (Run AFTER schema_v4_calendar_sync.sql)
-- ============================================
-- Features:
--   1. Separate "Todos" calendar (calendar_id in google_tokens)
--   2. Time-based events (start_time, end_time on todos)
--   3. Habit calendar sync tracking
--
-- IMPORTANT: After running this, update Google Cloud Console:
--   - Add scope: https://www.googleapis.com/auth/calendar
--   - Users must sign out and re-authenticate to grant the new scope
-- ============================================

-- 1. Add calendar_id to google_tokens (stores the "Todos" calendar ID)
ALTER TABLE public.google_tokens ADD COLUMN IF NOT EXISTS calendar_id text;

-- 2. Add time fields to todos (nullable, format "HH:MM")
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS end_time text;

-- 3. Habit calendar sync table (maps habits to Google Calendar recurring events)
CREATE TABLE IF NOT EXISTS public.habit_calendar_sync (
  id uuid default gen_random_uuid() primary key,
  habit_id uuid references public.habits on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  google_event_id text not null,
  synced_at timestamptz default now(),

  unique(habit_id)
);

ALTER TABLE public.habit_calendar_sync enable row level security;

CREATE POLICY "Users can view own habit_calendar_sync"
  ON public.habit_calendar_sync FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habit_calendar_sync"
  ON public.habit_calendar_sync FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habit_calendar_sync"
  ON public.habit_calendar_sync FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habit_calendar_sync"
  ON public.habit_calendar_sync FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_habit_calendar_sync_habit_id ON public.habit_calendar_sync(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_calendar_sync_user_id ON public.habit_calendar_sync(user_id);

SELECT 'schema_v5_calendar_enhanced migration complete' AS status;
