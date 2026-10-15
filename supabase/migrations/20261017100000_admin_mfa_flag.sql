-- A database-only switch that lets the owner skip TOTP for /admin while testing.
-- Default is "required"; it is not editable from the app (no policies, no grants to app roles).
create table public.security_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);
alter table public.security_flags enable row level security;
revoke all on public.security_flags from anon, authenticated;

insert into public.security_flags (key, enabled) values ('admin_mfa_required', true);

-- Returns only a boolean. A missing row means "required".
create function public.admin_mfa_required() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select enabled from public.security_flags where key = 'admin_mfa_required'),
    true
  );
$$;
revoke execute on function public.admin_mfa_required() from public, anon;
grant execute on function public.admin_mfa_required() to authenticated;

-- Same as 20261015100000_admin_security.sql, except the second factor is skipped while the flag is off.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (
      coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      or not public.admin_mfa_required()
    )
    and exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
    );
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
