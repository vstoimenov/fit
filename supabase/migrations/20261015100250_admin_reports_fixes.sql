-- Fixes: the latest snooze wins (not the longest), and LIKE wildcards in the search are matched literally.
create or replace function public.admin_client_stats(
  p_search text default null,
  p_limit int default 200,
  p_offset int default 0
) returns table (
  user_id uuid, name text, email text, phone text, phone_call_consent boolean,
  level public.workout_level, joined_at timestamptz, last_seen_at timestamptz, onboarding_done boolean,
  sub_status public.subscription_status, sub_provider public.payment_provider,
  current_period_end timestamptz, has_access boolean,
  total_done int, last_done_at timestamptz, done_7 int, done_30 int, minutes_7 int, minutes_30 int,
  published_14 int, done_regular_14 int, paid_without_workout boolean, snoozed_until timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  -- LIKE wildcards in the search text are matched literally.
  v_pattern text := '%' || replace(replace(replace(coalesce(p_search, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select
    b.id, b.name, b.email, b.phone, b.phone_call_consent, b.level, b.joined_at, b.last_seen_at,
    b.onboarding_done, s.status, s.provider, s.current_period_end,
    public.has_active_access(b.id),
    c.total_done, c.last_done_at, c.done_7, c.done_30, c.minutes_7, c.minutes_30,
    r.published_14, r.done_regular_14,
    coalesce(s.provider in ('stripe', 'revolut'), false)
      and public.has_active_access(b.id) and c.done_paid = 0,
    n.snoozed_until,
    count(*) over ()
  from public.profiles b
  left join public.subscriptions s on s.user_id = b.id
  left join lateral (
    select
      count(*)::int as total_done,
      max(cc.completed_at) as last_done_at,
      (count(*) filter (where cc.completed_at > now() - interval '7 days'))::int as done_7,
      (count(*) filter (where cc.completed_at > now() - interval '30 days'))::int as done_30,
      coalesce(sum(w.duration_min) filter (where cc.completed_at > now() - interval '7 days'), 0)::int as minutes_7,
      coalesce(sum(w.duration_min) filter (where cc.completed_at > now() - interval '30 days'), 0)::int as minutes_30,
      (count(*) filter (where w.kind <> 'free'))::int as done_paid
    from public.workout_completions cc
    join public.workouts w on w.id = cc.workout_id
    where cc.user_id = b.id
  ) c on true
  left join lateral (
    select
      count(*)::int as published_14,
      (count(*) filter (
        where exists (
          select 1 from public.workout_completions x where x.user_id = b.id and x.workout_id = w2.id
        )
      ))::int as done_regular_14
    from public.workouts w2
    where w2.kind = 'regular' and w2.level = b.level
      and w2.publish_at > now() - interval '14 days' and w2.publish_at <= now()
      and w2.publish_at >= coalesce(b.starter_week_done_at, b.joined_at)
  ) r on true
  left join lateral (
    select cn.snooze_until as snoozed_until
    from public.client_notes cn
    where cn.user_id = b.id and cn.kind = 'snooze'
    order by cn.created_at desc
    limit 1
  ) n on true
  where b.role = 'client'
    and (
      p_search is null or p_search = ''
      or b.name ilike v_pattern escape '\'
      or b.email ilike v_pattern escape '\'
    )
  order by b.joined_at desc
  limit greatest(least(p_limit, 1000), 1)
  offset greatest(p_offset, 0);
end $$;
revoke execute on function public.admin_client_stats(text, int, int) from public, anon;
grant execute on function public.admin_client_stats(text, int, int) to authenticated;

-- Dashboard numbers. Windows end at p_now; "right now" numbers (active, MRR) use the real clock.
-- Fixes: one source per visitor (the first visit in the window; own-host referrers are direct),
-- "active" is the set MRR sums, and funnel.paid skips subscriptions that never started.
drop function public.admin_dashboard(timestamptz);
create function public.admin_dashboard(
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
        select coalesce(sum(case pl.interval when 'year' then round(pl.price_cents / 12.0) else pl.price_cents end), 0)::bigint
        from public.subscriptions s
        join public.plans pl on pl.id = s.plan_id
        where s.provider <> 'manual' and s.status in ('active', 'trialing')
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
