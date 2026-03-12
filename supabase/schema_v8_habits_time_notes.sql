-- Migration v8: Add time and notes fields to habits
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS time text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

-- time format: "HH:MM" (24-hour), e.g. "09:00", "14:30"
-- notes: free-form text, nullable
