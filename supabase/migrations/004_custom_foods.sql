-- Custom foods: user-saved foods with exact macros for quick logging
create table public.custom_foods (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  food_name text not null,
  serving_description text,
  calories numeric(8,1) not null,
  protein_g numeric(7,1) not null default 0,
  carbs_g numeric(7,1) not null default 0,
  fat_g numeric(7,1) not null default 0,
  fiber_g numeric(7,1),
  sugar_g numeric(7,1),
  sodium_mg numeric(8,1),
  micronutrients jsonb default '{}',
  use_count integer default 0,
  last_used_at timestamptz default now(),
  created_at timestamptz default now() not null
);

alter table public.custom_foods enable row level security;

create policy "Users manage their own custom foods"
  on public.custom_foods for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_custom_foods_user on public.custom_foods(user_id);
create index idx_custom_foods_last_used on public.custom_foods(user_id, last_used_at desc);
