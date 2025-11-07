-- Reset RLS policies on public.drivers and enforce user_id-based access

-- Ensure column exists and typed correctly
alter table if exists public.drivers add column if not exists user_id uuid;
alter table if exists public.drivers alter column user_id type uuid using user_id::uuid;

-- Backfill user_id from auth.users by email (idempotent)
update public.drivers d
set user_id = u.id
from auth.users u
where lower(u.email) = lower(d.email)
  and d.user_id is distinct from u.id;

-- Helpful index
create index if not exists drivers_user_id_idx on public.drivers(user_id);

-- Enable RLS
alter table public.drivers enable row level security;

-- Drop all existing policies on drivers (safely)
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

-- Allow users to read their own driver row
create policy read_own_driver on public.drivers
for select using (user_id = auth.uid());

-- Allow users to update their own driver row (optional; keep if needed)
create policy update_own_driver on public.drivers
for update using (user_id = auth.uid());

-- Note: Inserts are performed by service role in edge functions and bypass RLS.

