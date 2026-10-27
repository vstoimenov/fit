-- Начало asked for the profile first and for next_drop_at(level) after it: two round trips in a row.
-- This variant reads the caller's level itself, so the page can ask for everything at once.
-- Same rule as next_drop_at: regular, plan-level workouts only (exclusive ones are bonus content).
create function public.next_drop_for_me() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select min(w.publish_at)
  from public.workouts w
  join public.profiles p on p.id = (select auth.uid())
  where w.kind = 'regular' and w.level = p.level and w.publish_at > now() and w.min_member_level is null;
$$;
revoke execute on function public.next_drop_for_me() from public, anon;
grant execute on function public.next_drop_for_me() to authenticated;
