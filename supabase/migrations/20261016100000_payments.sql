-- Raw provider webhooks, stored once per provider event. No FK to profiles: accounting records
-- must outlive account deletion.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  event_id text not null check (char_length(event_id) <= 255),
  type text not null check (char_length(type) <= 100),
  user_id uuid,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text check (char_length(error) <= 1000),
  unique (provider, event_id)
);
create index payment_events_user on public.payment_events (user_id, received_at desc);

alter table public.payment_events enable row level security;
create policy payment_events_admin_select on public.payment_events for select to authenticated
  using ((select public.is_admin()));
revoke all on public.payment_events from anon;
revoke insert, update, delete on public.payment_events from authenticated;

alter table public.subscriptions
  add column cancel_at_period_end boolean not null default false,
  add column price_cents integer check (price_cents is null or price_cents > 0),
  add column billing_interval public.plan_interval,
  add column provider_event_at timestamptz;

-- Which provider checkout uses. Settings are admin-only, so clients read just this one value.
create function public.active_payment_provider() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select value ->> 'provider' from public.settings where key = 'payment_provider'),
    'stripe'
  );
$$;
revoke execute on function public.active_payment_provider() from public, anon;
grant execute on function public.active_payment_provider() to authenticated, service_role;

-- Manual (comp) access granted by an admin. Extends a live manual grant from its end; replaces a
-- non-live row of any provider (former customer); refuses while a paid subscription is live.
create function public.admin_grant_manual(p_user_id uuid, p_days int) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions%rowtype;
  v_start timestamptz := now();
  v_end timestamptz;
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
    provider_sub_id = null, price_cents = null, billing_interval = null, provider_event_at = null;
  return v_end;
end $$;
revoke execute on function public.admin_grant_manual(uuid, int) from public, anon;
grant execute on function public.admin_grant_manual(uuid, int) to authenticated;

-- Dashboard: identical to 20261015100250 except MRR sums the price/interval snapshot stored on the
-- subscription (what the customer actually pays), falling back to the plan's current price.
create or replace function public.admin_dashboard(
  p_now timestamptz default now(),
  p_own_host text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day_start timestamptz := ((p_now at time zone 'Europe/Sofia')::date)::timestamp at time zone 'Europe/Sofia';
  v_7 timestamptz := p_now - interval '7 days';
  v_30 timestamptz := p_now - interval '30 days';
  v_own text := nullif(regexp_replace(lower(btrim(coalesce(p_own_host, ''))), '^www\.', ''), '');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'visits', jsonb_build_object(
      'today', (select count(*) from public.visits v where v.created_at >= v_day_start and v.created_at <= p_now),
      'd7', (select count(*) from public.visits v where v.created_at > v_7 and v.created_at <= p_now),
      'd30', (select count(*) from public.visits v where v.created_at > v_30 and v.created_at <= p_now),
      'unique_d30', (select count(distinct v.anon_id) from public.visits v where v.created_at > v_30 and v.created_at <= p_now)
    ),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', t.src, 'visitors', t.n) order by t.n desc, t.src)
      from (
        select f.src, count(*) as n
        from (
          select distinct on (v.anon_id)
            coalesce(
              nullif(lower(btrim(v.utm ->> 'utm_source')), ''),
              (
                select h.host
                from (
                  select regexp_replace(lower(split_part(split_part(coalesce(v.referrer, ''), '://', 2), '/', 1)), '^www\.', '') as host
                ) h
                where h.host <> '' and h.host is distinct from v_own
              ),
              'direct'
            ) as src
          from public.visits v
          where v.created_at > v_30 and v.created_at <= p_now
          order by v.anon_id, v.created_at
        ) f
        group by f.src
        order by n desc, f.src
        limit 10
      ) t
    ), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'visitors', (select count(distinct v.anon_id) from public.visits v where v.created_at > v_30 and v.created_at <= p_now),
      'signups', (select count(*) from public.profiles p where p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now),
      'free_done', (
        select count(distinct c.user_id)
        from public.workout_completions c
        join public.workouts w on w.id = c.workout_id
        join public.profiles p on p.id = c.user_id
        where w.kind = 'free' and p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now
      ),
      'paid', (
        select count(*)
        from public.subscriptions s
        join public.profiles p on p.id = s.user_id
        where s.provider <> 'manual' and s.status <> 'none'
          and p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now
      )
    ),
    'registrations', jsonb_build_object(
      'd7', (select count(*) from public.profiles p where p.role = 'client' and p.joined_at > v_7 and p.joined_at <= p_now),
      'd30', (select count(*) from public.profiles p where p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now)
    ),
    'subscriptions', jsonb_build_object(
      'active', (select count(*) from public.subscriptions s where s.provider <> 'manual' and s.status in ('active', 'trialing')),
      'mrr_cents', (
        select coalesce(sum(
          case coalesce(s.billing_interval, pl.interval)
            when 'year' then round(coalesce(s.price_cents, pl.price_cents) / 12.0)
            else coalesce(s.price_cents, pl.price_cents)
          end), 0)::bigint
        from public.subscriptions s
        left join public.plans pl on pl.id = s.plan_id
        where s.provider <> 'manual' and s.status in ('active', 'trialing')
          and coalesce(s.price_cents, pl.price_cents) is not null
      ),
      'canceled_30', (select count(*) from public.subscriptions s where s.provider <> 'manual' and s.canceled_at > v_30 and s.canceled_at <= p_now)
    ),
    'top_workouts', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'completions', t.n) order by t.n desc, t.title)
      from (
        select w.id, w.title, count(*) as n
        from public.workout_completions c
        join public.workouts w on w.id = c.workout_id
        where c.completed_at > v_30 and c.completed_at <= p_now
        group by w.id, w.title
        order by n desc
        limit 5
      ) t
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke execute on function public.admin_dashboard(timestamptz, text) from public, anon;
grant execute on function public.admin_dashboard(timestamptz, text) to authenticated;
