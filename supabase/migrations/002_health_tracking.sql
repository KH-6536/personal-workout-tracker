-- ============================================
-- Health Tracking & Whoop Integration
-- ============================================

-- ============================================
-- WHOOP TOKENS (OAuth2 tokens per user)
-- ============================================
create table public.whoop_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text,
  whoop_user_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.whoop_tokens enable row level security;

-- Users can only view their own connection status (not the raw tokens)
create policy "Users can view own whoop connection"
  on public.whoop_tokens for select using (auth.uid() = user_id);

-- Only service role can insert/update/delete (API routes use service key)
create policy "Service role manages whoop tokens"
  on public.whoop_tokens for all using (true) with check (true);

-- ============================================
-- HEALTH METRICS (daily aggregated data)
-- ============================================
create table public.health_metrics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  -- Body
  weight numeric(6,2),           -- in kg from Whoop
  weight_unit text default 'lbs',
  body_fat_pct numeric(5,2),
  lean_mass_kg numeric(6,2),
  -- Recovery
  recovery_score integer,        -- 0-100
  resting_heart_rate integer,
  hrv numeric(6,2),              -- ms
  spo2 numeric(5,2),             -- %
  skin_temp numeric(5,2),        -- celsius
  -- Strain
  strain_score numeric(4,1),     -- 0-21
  calories integer,
  -- Sleep
  sleep_duration_minutes integer,
  sleep_efficiency numeric(5,2), -- %
  sleep_performance integer,     -- 0-100
  -- Meta
  source text default 'whoop',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, date)
);

alter table public.health_metrics enable row level security;

create policy "Users can view own health metrics"
  on public.health_metrics for select using (auth.uid() = user_id);

create policy "Users can insert own health metrics"
  on public.health_metrics for insert with check (auth.uid() = user_id);

create policy "Users can update own health metrics"
  on public.health_metrics for update using (auth.uid() = user_id);

-- Service role policy for sync operations
create policy "Service role manages health metrics"
  on public.health_metrics for all using (true) with check (true);

-- ============================================
-- INDEXES
-- ============================================
create index idx_health_metrics_user_date on public.health_metrics(user_id, date desc);
create index idx_whoop_tokens_user on public.whoop_tokens(user_id);

-- ============================================
-- REALTIME
-- ============================================
alter publication supabase_realtime add table public.health_metrics;
