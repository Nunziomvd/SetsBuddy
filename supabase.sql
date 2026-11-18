-- SetsBuddy sync table. Paste this into Supabase → SQL Editor → New query, then click Run.
-- Each signed-in person gets exactly one row holding their data; nobody can read anyone else's row.

create table if not exists public.snapshots (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;

-- Signed-in users may use the table (row-level security below limits them to their own row).
-- Newer Supabase projects don't grant this automatically. Signed-out visitors (anon) get nothing.
grant select, insert, update on table public.snapshots to authenticated;
revoke all on table public.snapshots from anon;

drop policy if exists "read own snapshot"   on public.snapshots;
drop policy if exists "insert own snapshot" on public.snapshots;
drop policy if exists "update own snapshot" on public.snapshots;

create policy "read own snapshot" on public.snapshots
  for select using (auth.uid() = user_id);

create policy "insert own snapshot" on public.snapshots
  for insert with check (auth.uid() = user_id);

create policy "update own snapshot" on public.snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
