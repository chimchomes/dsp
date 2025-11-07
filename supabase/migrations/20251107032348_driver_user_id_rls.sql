-- Add user_id and backfill from auth.users
alter table if exists public.drivers add column if not exists user_id uuid;

update public.drivers d
set user_id = u.id
from auth.users u
where lower(u.email) = lower(d.email) and d.user_id is null;

-- Index for lookups
create index if not exists drivers_user_id_idx on public.drivers(user_id);

-- Enable RLS
alter table public.drivers enable row level security;

-- Policies: read/update own row
drop policy if exists read_own_driver on public.drivers;
create policy read_own_driver on public.drivers
for select using (user_id = auth.uid());

drop policy if exists update_own_driver on public.drivers;
create policy update_own_driver on public.drivers
for update using (user_id = auth.uid());
