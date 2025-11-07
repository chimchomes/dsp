-- Profiles table to store human-friendly names and email

create table if not exists public.profiles (
  user_id uuid primary key,
  first_name text,
  surname text,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(lower(email));

alter table public.profiles enable row level security;

-- RLS: admins can read all; each user can read their own
drop policy if exists profiles_admin_read_all on public.profiles;
create policy profiles_admin_read_all on public.profiles
for select using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
for select using (user_id = auth.uid());

-- RLS: HR and Finance can read drivers and admins
drop policy if exists profiles_hr_finance_read on public.profiles;
create policy profiles_hr_finance_read on public.profiles
for select using (
  exists (select 1 from public.user_roles me where me.user_id = auth.uid() and me.role in ('hr','finance'))
  and exists (select 1 from public.user_roles ur where ur.user_id = profiles.user_id and ur.role in ('driver','admin'))
);

-- RLS: Drivers can read admin/hr/finance profiles (to pick recipients)
drop policy if exists profiles_driver_read_recipients on public.profiles;
create policy profiles_driver_read_recipients on public.profiles
for select using (
  exists (select 1 from public.user_roles me where me.user_id = auth.uid() and me.role = 'driver')
  and exists (select 1 from public.user_roles ur where ur.user_id = profiles.user_id and ur.role in ('admin','hr','finance'))
);

-- Backfill from auth.users user_metadata
insert into public.profiles (user_id, first_name, surname, full_name, email)
select u.id,
       nullif(u.raw_user_meta_data->>'first_name',''),
       nullif(u.raw_user_meta_data->>'surname',''),
       coalesce(nullif(u.raw_user_meta_data->>'full_name',''),
                trim(concat_ws(' ', nullif(u.raw_user_meta_data->>'first_name',''), nullif(u.raw_user_meta_data->>'surname','')))),
       u.email
from auth.users u
on conflict (user_id) do update set
  first_name = excluded.first_name,
  surname = excluded.surname,
  full_name = excluded.full_name,
  email = excluded.email,
  updated_at = now();

-- Convenience view joining roles to profiles
create or replace view public.role_profiles as
select ur.role,
       p.user_id,
       coalesce(p.full_name, trim(concat_ws(' ', p.first_name, p.surname))) as full_name,
       p.first_name,
       p.surname,
       p.email
from public.user_roles ur
left join public.profiles p on p.user_id = ur.user_id;

