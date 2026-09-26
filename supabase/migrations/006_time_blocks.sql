-- ============================================
-- Time-blocking Schedule Tracker
-- ============================================

-- Categories: user-defined groupings shared by many blocks.
-- Editing color/icon here updates every block that references the category by name.
create table public.block_categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  color text not null default '#3b82f6',
  icon text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, name)
);

alter table public.block_categories enable row level security;

create policy "Users can view own block categories"
  on public.block_categories for select using (auth.uid() = user_id);
create policy "Users can insert own block categories"
  on public.block_categories for insert with check (auth.uid() = user_id);
create policy "Users can update own block categories"
  on public.block_categories for update using (auth.uid() = user_id);
create policy "Users can delete own block categories"
  on public.block_categories for delete using (auth.uid() = user_id);

create index block_categories_user_idx on public.block_categories (user_id);


-- Time blocks: individual scheduled entries for a specific date + time window.
create table public.time_blocks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  block_date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  category_name text,
  notes text,
  completed_at timestamptz,
  source text not null default 'manual',
  external_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  check (end_time > start_time)
);

alter table public.time_blocks enable row level security;

create policy "Users can view own time blocks"
  on public.time_blocks for select using (auth.uid() = user_id);
create policy "Users can insert own time blocks"
  on public.time_blocks for insert with check (auth.uid() = user_id);
create policy "Users can update own time blocks"
  on public.time_blocks for update using (auth.uid() = user_id);
create policy "Users can delete own time blocks"
  on public.time_blocks for delete using (auth.uid() = user_id);

create index time_blocks_user_date_idx on public.time_blocks (user_id, block_date);
create index time_blocks_category_idx on public.time_blocks (user_id, category_name);

-- Prevent duplicates when a calendar sync re-imports the same event.
create unique index time_blocks_external_unique
  on public.time_blocks (user_id, source, external_id)
  where external_id is not null;


-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger block_categories_touch
  before update on public.block_categories
  for each row execute function public.touch_updated_at();

create trigger time_blocks_touch
  before update on public.time_blocks
  for each row execute function public.touch_updated_at();
