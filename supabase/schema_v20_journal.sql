-- ============================================
-- v20: Journal
--
-- One entry per user and day. The date is the key people think in,
-- so it carries the unique constraint and the app upserts on it.
--
-- Additive only. Safe to run more than once.
-- ============================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT journal_entries_user_date_key UNIQUE (user_id, entry_date)
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own journal entries" ON public.journal_entries;
CREATE POLICY "Users can view their own journal entries"
  ON public.journal_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own journal entries" ON public.journal_entries;
CREATE POLICY "Users can insert their own journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own journal entries" ON public.journal_entries;
CREATE POLICY "Users can update their own journal entries"
  ON public.journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own journal entries" ON public.journal_entries;
CREATE POLICY "Users can delete their own journal entries"
  ON public.journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- The app always reads a user's entries newest first, or one exact day
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON public.journal_entries(user_id, entry_date DESC);
