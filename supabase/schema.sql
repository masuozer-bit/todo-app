-- ============================================
-- Minimalist To-Do App – Supabase Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  theme_preference text default 'light' check (theme_preference in ('light', 'dark')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- TAGS TABLE
-- ============================================
create table public.tags (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),

  unique(user_id, name)
);

alter table public.tags enable row level security;

create policy "Users can view own tags"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "Users can create own tags"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tags"
  on public.tags for update
  using (auth.uid() = user_id);

create policy "Users can delete own tags"
  on public.tags for delete
  using (auth.uid() = user_id);

-- ============================================
-- TODOS TABLE
-- ============================================
create table public.todos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  completed boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.todos enable row level security;

create policy "Users can view own todos"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "Users can create own todos"
  on public.todos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own todos"
  on public.todos for update
  using (auth.uid() = user_id);

create policy "Users can delete own todos"
  on public.todos for delete
  using (auth.uid() = user_id);

-- ============================================
-- TODO_TAGS JUNCTION TABLE
-- ============================================
create table public.todo_tags (
  todo_id uuid references public.todos on delete cascade not null,
  tag_id uuid references public.tags on delete cascade not null,
  primary key (todo_id, tag_id)
);

alter table public.todo_tags enable row level security;

create policy "Users can view own todo_tags"
  on public.todo_tags for select
  using (
    exists (
      select 1 from public.todos
      where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
    )
  );

create policy "Users can create own todo_tags"
  on public.todo_tags for insert
  with check (
    exists (
      select 1 from public.todos
      where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
    )
  );

create policy "Users can delete own todo_tags"
  on public.todo_tags for delete
  using (
    exists (
      select 1 from public.todos
      where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES
-- ============================================
create index idx_todos_user_id on public.todos(user_id);
create index idx_todos_sort_order on public.todos(user_id, sort_order);
create index idx_tags_user_id on public.tags(user_id);
create index idx_todo_tags_todo_id on public.todo_tags(todo_id);
create index idx_todo_tags_tag_id on public.todo_tags(tag_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_todos_updated_at
  before update on public.todos
  for each row execute procedure public.update_updated_at();

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();
