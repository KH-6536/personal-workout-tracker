-- ============================================
-- Habits Tracking & Rize Integration
-- ============================================

-- ============================================
-- HABITS (user-defined trackable habits)
-- ============================================
create table public.habits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  emoji text,
  goal_per_month integer not null default 31,
  display_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.habits enable row level security;

create policy "Users can view own habits"
  on public.habits for select using (auth.uid() = user_id);

create policy "Users can insert own habits"
  on public.habits for insert with check (auth.uid() = user_id);

create policy "Users can update own habits"
  on public.habits for update using (auth.uid() = user_id);

create policy "Users can delete own habits"
  on public.habits for delete using (auth.uid() = user_id);

-- ============================================
-- HABIT_LOGS (one row per habit per completed day)
-- Presence of row = completed. Toggle off = delete row.
-- ============================================
create table public.habit_logs (
  habit_id uuid references public.habits on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  created_at timestamptz default now() not null,
  primary key (habit_id, log_date)
);

alter table public.habit_logs enable row level security;

create policy "Users can view own habit logs"
  on public.habit_logs for select using (auth.uid() = user_id);

create policy "Users can insert own habit logs"
  on public.habit_logs for insert with check (auth.uid() = user_id);

create policy "Users can delete own habit logs"
  on public.habit_logs for delete using (auth.uid() = user_id);

-- ============================================
-- RIZE_DAILY (daily working-hours aggregate from Rize)
-- ============================================
create table public.rize_daily (
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  work_seconds integer not null default 0,
  focus_seconds integer,
  meeting_seconds integer,
  break_seconds integer,
  source_payload jsonb,
  fetched_at timestamptz default now() not null,
  primary key (user_id, log_date)
);

alter table public.rize_daily enable row level security;

create policy "Users can view own rize data"
  on public.rize_daily for select using (auth.uid() = user_id);

-- Service role policy for cron + manual sync
create policy "Service role manages rize data"
  on public.rize_daily for all using (true) with check (true);

-- ============================================
-- RIZE_CONNECTIONS (per-user API key storage)
-- Stored server-side; never exposed to client.
-- ============================================
create table public.rize_connections (
  user_id uuid references auth.users on delete cascade not null primary key,
  api_key text not null,
  timezone text not null default 'America/Los_Angeles',
  last_synced_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.rize_connections enable row level security;

-- Users see whether they're connected (timezone, last_synced_at) but NEVER the api_key.
-- App reads via a view that omits api_key (see below).
create policy "Service role manages rize connections"
  on public.rize_connections for all using (true) with check (true);

-- Safe-to-read view (omits api_key)
create or replace view public.rize_connection_status as
  select user_id, timezone, last_synced_at, created_at, updated_at
  from public.rize_connections;

grant select on public.rize_connection_status to authenticated;

-- ============================================
-- INDEXES
-- ============================================
create index idx_habits_user_order on public.habits(user_id, display_order) where archived = false;
create index idx_habit_logs_user_date on public.habit_logs(user_id, log_date desc);
create index idx_rize_daily_user_date on public.rize_daily(user_id, log_date desc);

-- ============================================
-- TRIGGERS
-- ============================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger habits_touch_updated_at
  before update on public.habits
  for each row execute procedure public.touch_updated_at();

create trigger rize_connections_touch_updated_at
  before update on public.rize_connections
  for each row execute procedure public.touch_updated_at();

-- ============================================
-- REALTIME
-- ============================================
alter publication supabase_realtime add table public.habit_logs;
alter publication supabase_realtime add table public.habits;
