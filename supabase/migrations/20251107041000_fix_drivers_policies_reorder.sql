-- RESET drivers RLS to user_id, with safe ordering

-- 1) Drop all existing policies first (avoids “column used in policy” error)
do $$
declare r record;
begin
  for r in (
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'drivers'
  ) loop
    execute format('drop policy if exists %I on public.drivers', r.policyname);
  end loop;
end$$;

-- 2) Ensure column exists
alter table if exists public.drivers
  add column if not exists user_id uuid;

-- 3) If user_id is not uuid yet, convert it
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'drivers'
      and column_name = 'user_id'
      and data_type <> 'uuid'
  ) then
    execute 'alter table public.drivers alter column user_id type uuid using user_id::uuid';
  end if;
end$$;

-- 4) Backfill user_id from auth.users by email (idempotent)
update public.drivers d
set user_id = u.id
from auth.users u
where lower(u.email) = lower(d.email)
  and (d.user_id is distinct from u.id or d.user_id is null);

-- 5) Index for lookups
create index if not exists drivers_user_id_idx on public.drivers(user_id);

-- 6) Enable RLS
alter table public.drivers enable row level security;

-- 7) Recreate user_id-only policies
create policy read_own_driver on public.drivers
for select using (user_id = auth.uid());

create policy update_own_driver on public.drivers
for update using (user_id = auth.uid());

-- Note: Inserts are performed by service role in edge functions and bypass RLS.

