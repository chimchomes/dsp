-- Notifications data model with RLS for admin<->driver messaging

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  recipient_id uuid not null,
  title text not null,
  body text not null,
  kind text default 'message' check (kind in ('message','alert','system','message')),
  meta jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient_id, read_at) where read_at is null;

alter table public.notifications enable row level security;

-- Role helpers
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.user_roles where user_id=uid and role='admin')
$$;

create or replace function public.is_driver(uid uuid)
returns boolean language sql stable as $$
  select exists(select 1 from public.user_roles where user_id=uid and role='driver')
$$;

-- RLS policies
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications
for select using (
  sender_id = auth.uid() or recipient_id = auth.uid()
);

drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications
for insert with check (
  sender_id = auth.uid()
);

drop policy if exists notif_update_read on public.notifications;
create policy notif_update_read on public.notifications
for update using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

-- Note: Cross-role targeting will be validated in the edge function.

