-- ============================================
-- Schema V6 – Per-list Google Calendars (Run AFTER schema_v5_calendar_enhanced.sql)
-- ============================================

-- Each list maps to its own Google Calendar so users can toggle visibility
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS google_calendar_id text;

-- Habits get their own calendar
ALTER TABLE public.google_tokens ADD COLUMN IF NOT EXISTS habits_calendar_id text;

-- Track which Google Calendar each synced event lives in
-- (needed for moving events between calendars when list changes)
ALTER TABLE public.calendar_sync ADD COLUMN IF NOT EXISTS google_calendar_id text;
ALTER TABLE public.habit_calendar_sync ADD COLUMN IF NOT EXISTS google_calendar_id text;

select 'schema_v6_list_calendars migration complete' as status;
