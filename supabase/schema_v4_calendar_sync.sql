-- ============================================
-- Schema V4 – Calendar Sync (Run AFTER schema_v3_habits.sql)
-- ============================================

-- ============================================
-- GOOGLE_TOKENS TABLE
-- Stores the user's Google OAuth tokens for Calendar API access
-- ============================================
create table if not exists public.google_tokens (
  user_id uuid references auth.users on delete cascade primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scopes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.google_tokens enable row level security;

create policy "Users can view own google_tokens"
  on public.google_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own google_tokens"
  on public.google_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own google_tokens"
  on public.google_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete own google_tokens"
  on public.google_tokens for delete
  using (auth.uid() = user_id);

-- ============================================
-- CALENDAR_SYNC TABLE
-- Maps todo IDs to Google Calendar event IDs
-- ============================================
create table if not exists public.calendar_sync (
  id uuid default gen_random_uuid() primary key,
  todo_id uuid references public.todos on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  google_event_id text not null,
  synced_at timestamptz default now(),

  unique(todo_id)
);

alter table public.calendar_sync enable row level security;

create policy "Users can view own calendar_sync"
  on public.calendar_sync for select
  using (auth.uid() = user_id);

create policy "Users can insert own calendar_sync"
  on public.calendar_sync for insert
  with check (auth.uid() = user_id);

create policy "Users can update own calendar_sync"
  on public.calendar_sync for update
  using (auth.uid() = user_id);

create policy "Users can delete own calendar_sync"
  on public.calendar_sync for delete
  using (auth.uid() = user_id);

create index if not exists idx_calendar_sync_todo_id on public.calendar_sync(todo_id);
create index if not exists idx_calendar_sync_user_id on public.calendar_sync(user_id);

-- Updated_at trigger for google_tokens
create trigger update_google_tokens_updated_at
  before update on public.google_tokens
  for each row execute procedure public.update_updated_at();

select 'schema_v4_calendar_sync migration complete' as status;
