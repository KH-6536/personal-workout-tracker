-- ============================================
-- Google Calendar (iCal URL) connection
-- ============================================
-- One row per user. Stores the private iCal URL exported from Google Calendar.
-- The URL is a secret (grants read access to the calendar), so RLS + service-role
-- reads on the server keep it out of other users' hands.

create table public.gcal_connections (
  user_id uuid primary key references auth.users on delete cascade,
  ical_url text not null,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.gcal_connections enable row level security;

create policy "Users can view own gcal connection"
  on public.gcal_connections for select using (auth.uid() = user_id);
create policy "Users can insert own gcal connection"
  on public.gcal_connections for insert with check (auth.uid() = user_id);
create policy "Users can update own gcal connection"
  on public.gcal_connections for update using (auth.uid() = user_id);
create policy "Users can delete own gcal connection"
  on public.gcal_connections for delete using (auth.uid() = user_id);

create trigger gcal_connections_touch
  before update on public.gcal_connections
  for each row execute function public.touch_updated_at();
