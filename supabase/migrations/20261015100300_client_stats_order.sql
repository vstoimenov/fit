-- Stable paging: equal joined_at values (same-second signups) no longer shuffle between pages.
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
  order by b.joined_at desc, b.id
  limit greatest(least(p_limit, 1000), 1)
  offset greatest(p_offset, 0);
end $$;
revoke execute on function public.admin_client_stats(text, int, int) from public, anon;
grant execute on function public.admin_client_stats(text, int, int) to authenticated;
