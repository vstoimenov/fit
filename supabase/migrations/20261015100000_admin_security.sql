-- Admin powers need the second factor: an admin session that has not passed TOTP (aal1) is a client.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (
       select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
     );
$$;

-- Manual (comp) grants may carry an end date and expire on it. Paid active subscriptions ignore a
-- stale period end, because the provider's renewal webhook can arrive after it.
create or replace function public.has_active_access(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and (
        (
          s.status in ('active', 'trialing')
          and not (
            s.provider = 'manual'
            and s.current_period_end is not null
            and s.current_period_end <= now()
          )
        )
        or (s.status = 'past_due' and s.grace_until > now())
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  );
$$;

alter table public.subscriptions
  add column created_at timestamptz not null default now(),
  add column canceled_at timestamptz;

-- profiles.email is a copy for admin views and email sending; keep it in step with auth.
create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_profile_email();
