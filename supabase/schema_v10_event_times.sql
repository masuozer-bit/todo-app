-- schema_v10_event_times.sql
-- Add start_time and end_time to events table

ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TEXT;
