-- v14: Add list_id to habits so habits can be assigned to a list

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.lists(id) ON DELETE SET NULL;

-- Index for filtering habits by list
CREATE INDEX IF NOT EXISTS habits_list_id_idx ON public.habits(list_id);
