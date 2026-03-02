-- schema_v9_event_dates.sql
-- Add optional due_date and end_date to events table

ALTER TABLE events ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE;
