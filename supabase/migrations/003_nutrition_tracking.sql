-- ============================================
-- Nutrition Tracking
-- ============================================

-- ============================================
-- NUTRITION GOALS (per-user daily targets)
-- ============================================
create table public.nutrition_goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  calorie_target integer default 2500,
  protein_g numeric(6,1) default 180,
  carbs_g numeric(6,1) default 250,
  fat_g numeric(6,1) default 80,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.nutrition_goals enable row level security;

create policy "Users can view own nutrition goals"
  on public.nutrition_goals for select using (auth.uid() = user_id);
create policy "Users can insert own nutrition goals"
  on public.nutrition_goals for insert with check (auth.uid() = user_id);
create policy "Users can update own nutrition goals"
  on public.nutrition_goals for update using (auth.uid() = user_id);

-- ============================================
-- FOOD LOGS (individual food entries)
-- ============================================
create table public.food_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  serving_description text,
  calories numeric(8,1),
  protein_g numeric(7,1),
  carbs_g numeric(7,1),
  fat_g numeric(7,1),
  fiber_g numeric(7,1),
  sugar_g numeric(7,1),
  sodium_mg numeric(8,1),
  micronutrients jsonb default '{}',
  source text default 'nlp',
  raw_input text,
  created_at timestamptz default now() not null
);

alter table public.food_logs enable row level security;

create policy "Users can view own food logs"
  on public.food_logs for select using (auth.uid() = user_id);
create policy "Users can insert own food logs"
  on public.food_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own food logs"
  on public.food_logs for update using (auth.uid() = user_id);
create policy "Users can delete own food logs"
  on public.food_logs for delete using (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
create index idx_food_logs_user_date on public.food_logs(user_id, date desc);
create index idx_food_logs_date_meal on public.food_logs(user_id, date, meal_type);

-- ============================================
-- REALTIME
-- ============================================
alter publication supabase_realtime add table public.food_logs;
