-- ============================================
-- Schema V2 – Run this AFTER schema.sql
-- ============================================

-- Add new columns to todos
alter table public.todos
  add column if not exists due_date date,
  add column if not exists priority text default 'none' check (priority in ('high', 'medium', 'low', 'none')),
  add column if not exists notes text,
  add column if not exists list_id uuid;

-- ============================================
-- LISTS TABLE (Projects)
-- ============================================
create table if not exists public.lists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.lists enable row level security;

drop policy if exists "Users can view own lists" on public.lists;
create policy "Users can view own lists"
  on public.lists for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own lists" on public.lists;
create policy "Users can create own lists"
  on public.lists for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own lists" on public.lists;
create policy "Users can update own lists"
  on public.lists for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own lists" on public.lists;
create policy "Users can delete own lists"
  on public.lists for delete
  using (auth.uid() = user_id);

-- Add foreign key for list_id (skip if already exists)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'todos_list_id_fkey'
      and table_name = 'todos'
  ) then
    alter table public.todos
      add constraint todos_list_id_fkey
      foreign key (list_id) references public.lists(id) on delete set null;
  end if;
end $$;

-- ============================================
-- SUBTASKS TABLE
-- ============================================
create table if not exists public.subtasks (
  id uuid default uuid_generate_v4() primary key,
  todo_id uuid references public.todos on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  completed boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.subtasks enable row level security;

drop policy if exists "Users can view own subtasks" on public.subtasks;
create policy "Users can view own subtasks"
  on public.subtasks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own subtasks" on public.subtasks;
create policy "Users can create own subtasks"
  on public.subtasks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own subtasks" on public.subtasks;
create policy "Users can update own subtasks"
  on public.subtasks for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own subtasks" on public.subtasks;
create policy "Users can delete own subtasks"
  on public.subtasks for delete
  using (auth.uid() = user_id);

create index if not exists idx_subtasks_todo_id on public.subtasks(todo_id);
create index if not exists idx_lists_user_id on public.lists(user_id);

select 'schema_v2 migration complete' as status;
