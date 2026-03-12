-- Add end_time column to habits table
ALTER TABLE habits ADD COLUMN IF NOT EXISTS end_time TEXT;
