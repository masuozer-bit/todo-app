-- ============================================
-- v19: indexes, a unique key for calendar imports,
--      and per-user timezone / language
--
-- Safe to run more than once.
-- ============================================

-- ── Indexes for the queries the app actually runs ──────────────────────
create index if not exists idx_todos_user_due_date
  on public.todos(user_id, due_date);

create index if not exists idx_todos_list_id
  on public.todos(list_id);

create index if not exists idx_todos_user_event
  on public.todos(user_id, event_id);

create index if not exists idx_subtasks_user_id
  on public.subtasks(user_id);

create index if not exists idx_habit_completions_user_date
  on public.habit_completions(user_id, completed_date);

create index if not exists idx_habit_skips_user_date
  on public.habit_skips(user_id, skip_date);

create index if not exists idx_templates_user_id
  on public.templates(user_id);

create index if not exists idx_rules_user_sort
  on public.rules(user_id, sort_order);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions(user_id);

-- ── One row per imported Google Calendar event ─────────────────────────
-- Without this, a second import in a parallel tab can create duplicates.
create unique index if not exists idx_todos_user_google_event
  on public.todos(user_id, google_event_id)
  where google_event_id is not null;

-- ── Per-user timezone and language ─────────────────────────────────────
-- The daily reminder cron needs the timezone to know when 08:00 is for
-- this user; the app fills it in on load from the browser.
alter table public.profiles
  add column if not exists timezone text;

alter table public.profiles
  add column if not exists locale text;

select 'schema_v19 migration complete' as status;
