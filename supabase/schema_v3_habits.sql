-- ============================================
-- Schema V3 – Habits (Run AFTER schema_v2.sql)
-- ============================================

-- ============================================
-- HABITS TABLE
-- ============================================
create table if not exists public.habits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  schedule_type text not null default 'interval' check (schedule_type in ('interval', 'weekly')),
  schedule_days integer[] default '{}',
  schedule_interval integer not null default 1,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.habits enable row level security;

drop policy if exists "Users can view own habits" on public.habits;
create policy "Users can view own habits"
  on public.habits for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own habits" on public.habits;
create policy "Users can create own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own habits" on public.habits;
create policy "Users can update own habits"
  on public.habits for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own habits" on public.habits;
create policy "Users can delete own habits"
  on public.habits for delete
  using (auth.uid() = user_id);

-- ============================================
-- HABIT_COMPLETIONS TABLE
-- ============================================
create table if not exists public.habit_completions (
  id uuid default uuid_generate_v4() primary key,
  habit_id uuid references public.habits on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  completed_date date not null,
  created_at timestamptz default now(),

  unique(habit_id, completed_date)
);

alter table public.habit_completions enable row level security;

drop policy if exists "Users can view own habit_completions" on public.habit_completions;
create policy "Users can view own habit_completions"
  on public.habit_completions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own habit_completions" on public.habit_completions;
create policy "Users can create own habit_completions"
  on public.habit_completions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own habit_completions" on public.habit_completions;
create policy "Users can delete own habit_completions"
  on public.habit_completions for delete
  using (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_habits_user_id on public.habits(user_id);
create index if not exists idx_habits_sort_order on public.habits(user_id, sort_order);
create index if not exists idx_habit_completions_habit_id on public.habit_completions(habit_id);
create index if not exists idx_habit_completions_date on public.habit_completions(habit_id, completed_date);

-- ============================================
-- UPDATED_AT TRIGGER (reuse existing function)
-- ============================================
create trigger update_habits_updated_at
  before update on public.habits
  for each row execute procedure public.update_updated_at();

select 'schema_v3_habits migration complete' as status;
