-- Add google_event_id to todos table for reverse sync from Google Calendar
ALTER TABLE todos ADD COLUMN IF NOT EXISTS google_event_id text DEFAULT NULL;

-- Index for fast lookup when syncing
CREATE INDEX IF NOT EXISTS idx_todos_google_event_id ON todos(google_event_id) WHERE google_event_id IS NOT NULL;

-- Unique constraint: one google event per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_google_event_id_user ON todos(user_id, google_event_id) WHERE google_event_id IS NOT NULL;

-- Clean up: remove google_event_id from events table if it was added
ALTER TABLE events DROP COLUMN IF EXISTS google_event_id;
