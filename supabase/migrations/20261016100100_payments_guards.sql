-- Same signature and body as 20261016100000, plus: the insert-or-update itself refuses to touch a
-- live paid row. The existence check above runs before the insert, so a paid subscription that
-- lands in between (webhook racing an admin click) would otherwise be overwritten by the grant.
create or replace function public.admin_grant_manual(p_user_id uuid, p_days int) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions%rowtype;
  v_start timestamptz := now();
  v_end timestamptz;
  v_rows int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'days must be 1..365' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'client') then
    raise exception 'client not found' using errcode = 'P0002';
  end if;
  select * into s from public.subscriptions where user_id = p_user_id for update;
  if found then
    if s.provider <> 'manual' and public.has_active_access(p_user_id) then
      raise exception 'paid subscription is live' using errcode = '23P01';
    end if;
    if s.provider = 'manual' and s.status = 'active'
       and s.current_period_end is not null and s.current_period_end > now() then
      v_start := s.current_period_end;
    end if;
  end if;
  v_end := v_start + make_interval(days => p_days);
  insert into public.subscriptions as t (user_id, provider, status, current_period_end, grace_until, canceled_at,
                                         cancel_at_period_end, plan_id, provider_customer_id, provider_sub_id,
                                         price_cents, billing_interval, provider_event_at)
  values (p_user_id, 'manual', 'active', v_end, null, null, false, null, null, null, null, null, null)
  on conflict (user_id) do update set
    provider = 'manual', status = 'active', current_period_end = excluded.current_period_end,
    grace_until = null, canceled_at = null, cancel_at_period_end = false, plan_id = null,
    provider_sub_id = null, price_cents = null, billing_interval = null, provider_event_at = null
  -- Liveness is read from the locked row itself: has_active_access() is STABLE, so it would query
  -- with the statement's old snapshot and miss a paid row committed while this insert waited.
  where t.provider = 'manual'
     or not coalesce(
          t.status in ('active', 'trialing')
          or (t.status = 'past_due' and t.grace_until > now())
          or (t.status = 'canceled' and t.current_period_end > now()),
          false);
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'paid subscription is live' using errcode = '23P01';
  end if;
  return v_end;
end $$;
revoke execute on function public.admin_grant_manual(uuid, int) from public, anon;
grant execute on function public.admin_grant_manual(uuid, int) to authenticated;

-- Only a known provider is ever returned; a stray settings value must not steer checkout.
create or replace function public.active_payment_provider() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select value ->> 'provider' from public.settings
      where key = 'payment_provider' and value ->> 'provider' in ('stripe', 'revolut')),
    'stripe'
  );
$$;
revoke execute on function public.active_payment_provider() from public, anon;
grant execute on function public.active_payment_provider() to authenticated, service_role;
