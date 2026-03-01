-- V7: Recurring tasks support
-- Run this in the Supabase SQL Editor

-- Add recurrence columns to todos
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT NULL;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1;

-- Add constraint for valid recurrence types
-- (nullable, but if set must be one of these values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_recurrence_type_check'
  ) THEN
    ALTER TABLE public.todos ADD CONSTRAINT todos_recurrence_type_check
      CHECK (recurrence_type IS NULL OR recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly'));
  END IF;
END $$;
