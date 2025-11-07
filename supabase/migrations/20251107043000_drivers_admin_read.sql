-- Allow admins to read drivers for messaging UI
alter table public.drivers enable row level security;

drop policy if exists admin_read_all_drivers on public.drivers;
create policy admin_read_all_drivers on public.drivers
for select using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  )
);

