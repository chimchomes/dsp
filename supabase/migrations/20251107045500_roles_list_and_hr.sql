-- Ensure 'hr' exists in app_role enum and expose a central roles list

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'hr'
  ) then
    alter type public.app_role add value 'hr';
  end if;
end$$;

create or replace view public.roles_list as
select unnest(enum_range(null::public.app_role))::text as role;

