-- ============================================
-- Personal Workout Tracker - Database Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- EXERCISES (global exercise library)
-- ============================================
create table public.exercises (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  muscle_group text,
  created_at timestamptz default now() not null,
  unique(user_id, name)
);

alter table public.exercises enable row level security;

create policy "Users can view own exercises"
  on public.exercises for select using (auth.uid() = user_id);

create policy "Users can insert own exercises"
  on public.exercises for insert with check (auth.uid() = user_id);

create policy "Users can update own exercises"
  on public.exercises for update using (auth.uid() = user_id);

create policy "Users can delete own exercises"
  on public.exercises for delete using (auth.uid() = user_id);

-- ============================================
-- SPLIT TEMPLATES
-- ============================================
create table public.split_templates (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.split_templates enable row level security;

create policy "Users can view own templates"
  on public.split_templates for select using (auth.uid() = user_id);

create policy "Users can insert own templates"
  on public.split_templates for insert with check (auth.uid() = user_id);

create policy "Users can update own templates"
  on public.split_templates for update using (auth.uid() = user_id);

create policy "Users can delete own templates"
  on public.split_templates for delete using (auth.uid() = user_id);

-- ============================================
-- TEMPLATE EXERCISES (exercises within a split)
-- ============================================
create table public.template_exercises (
  id uuid default uuid_generate_v4() primary key,
  template_id uuid references public.split_templates on delete cascade not null,
  exercise_id uuid references public.exercises on delete cascade not null,
  sort_order integer not null default 0,
  default_sets integer not null default 3,
  created_at timestamptz default now() not null
);

alter table public.template_exercises enable row level security;

create policy "Users can view own template exercises"
  on public.template_exercises for select
  using (exists (
    select 1 from public.split_templates
    where id = template_exercises.template_id and user_id = auth.uid()
  ));

create policy "Users can insert own template exercises"
  on public.template_exercises for insert
  with check (exists (
    select 1 from public.split_templates
    where id = template_exercises.template_id and user_id = auth.uid()
  ));

create policy "Users can update own template exercises"
  on public.template_exercises for update
  using (exists (
    select 1 from public.split_templates
    where id = template_exercises.template_id and user_id = auth.uid()
  ));

create policy "Users can delete own template exercises"
  on public.template_exercises for delete
  using (exists (
    select 1 from public.split_templates
    where id = template_exercises.template_id and user_id = auth.uid()
  ));

-- ============================================
-- WEEKLY SCHEDULE (maps day-of-week to template)
-- ============================================
create table public.weekly_schedule (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sunday
  template_id uuid references public.split_templates on delete set null,
  unique(user_id, day_of_week)
);

alter table public.weekly_schedule enable row level security;

create policy "Users can view own schedule"
  on public.weekly_schedule for select using (auth.uid() = user_id);

create policy "Users can insert own schedule"
  on public.weekly_schedule for insert with check (auth.uid() = user_id);

create policy "Users can update own schedule"
  on public.weekly_schedule for update using (auth.uid() = user_id);

create policy "Users can delete own schedule"
  on public.weekly_schedule for delete using (auth.uid() = user_id);

-- ============================================
-- WORKOUT SESSIONS (completed workouts)
-- ============================================
create table public.workout_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  template_id uuid references public.split_templates on delete set null,
  template_name text, -- snapshot of template name at time of workout
  started_at timestamptz not null,
  completed_at timestamptz default now() not null,
  notes text,
  created_at timestamptz default now() not null
);

alter table public.workout_sessions enable row level security;

create policy "Users can view own sessions"
  on public.workout_sessions for select using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.workout_sessions for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.workout_sessions for update using (auth.uid() = user_id);

-- ============================================
-- WORKOUT SETS (individual sets within a session)
-- ============================================
create table public.workout_sets (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.workout_sessions on delete cascade not null,
  exercise_id uuid references public.exercises on delete set null,
  exercise_name text not null, -- snapshot of exercise name
  set_number integer not null,
  reps integer,
  weight numeric(7,2), -- up to 99999.99
  created_at timestamptz default now() not null
);

alter table public.workout_sets enable row level security;

create policy "Users can view own sets"
  on public.workout_sets for select
  using (exists (
    select 1 from public.workout_sessions
    where id = workout_sets.session_id and user_id = auth.uid()
  ));

create policy "Users can insert own sets"
  on public.workout_sets for insert
  with check (exists (
    select 1 from public.workout_sessions
    where id = workout_sets.session_id and user_id = auth.uid()
  ));

-- ============================================
-- INDEXES for performance
-- ============================================
create index idx_exercises_user on public.exercises(user_id);
create index idx_split_templates_user on public.split_templates(user_id);
create index idx_template_exercises_template on public.template_exercises(template_id);
create index idx_weekly_schedule_user on public.weekly_schedule(user_id);
create index idx_workout_sessions_user on public.workout_sessions(user_id);
create index idx_workout_sessions_completed on public.workout_sessions(user_id, completed_at);
create index idx_workout_sets_session on public.workout_sets(session_id);
create index idx_workout_sets_exercise on public.workout_sets(exercise_id);

-- ============================================
-- REALTIME subscriptions
-- ============================================
alter publication supabase_realtime add table public.workout_sessions;
alter publication supabase_realtime add table public.workout_sets;
