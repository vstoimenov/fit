-- The trainer's side: walk-ins (beyond the limit if the room allows), removals, cancelled
-- trainings, and slot edits that move only the trainings nobody has booked yet.

-- A slot that already has a training on a date (e.g. a booked one kept at the old time) gets no
-- second one that day.
create or replace function public.studio_ensure_sessions(p_days int default 14, p_today date default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Europe/Sofia')::date);
begin
  insert into public.studio_sessions (slot_id, starts_at, duration_min, title, capacity)
  select sl.id, (d::date + sl.start_time) at time zone 'Europe/Sofia', sl.duration_min, sl.title,
    sl.capacity
  from public.studio_slots sl
  cross join generate_series(v_today, v_today + (greatest(p_days, 1) - 1), interval '1 day') d
  where sl.active and extract(isodow from d) = sl.weekday
    and not exists (
      select 1 from public.studio_sessions x
      where x.slot_id = sl.id and (x.starts_at at time zone 'Europe/Sofia')::date = d::date
    )
  on conflict (slot_id, starts_at) do nothing;
end $$;
revoke execute on function public.studio_ensure_sessions(int, date) from public, anon, authenticated;

create function public.studio_admin_add(p_session_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.studio_sessions%rowtype;
  v_card uuid;
  v_over boolean;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.studio_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if s.cancelled_at is not null then
    raise exception 'session cancelled' using errcode = 'P0001';
  end if;
  if now() >= s.starts_at + make_interval(mins => s.duration_min) then
    raise exception 'session over' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.studio_bookings b
    where b.session_id = s.id and b.user_id = p_user_id and b.status = 'booked'
  ) then
    raise exception 'already booked' using errcode = 'P0001';
  end if;
  v_over := (
    select count(*) from public.studio_bookings b where b.session_id = s.id and b.status = 'booked'
  ) >= s.capacity;
  v_card := public.studio_pick_card(p_user_id, (s.starts_at at time zone 'Europe/Sofia')::date);
  insert into public.studio_bookings (session_id, user_id, card_id, source, over_limit)
  values (s.id, p_user_id, v_card, 'admin', v_over)
  returning id into v_id;
  update public.profiles set studio_client = true where id = p_user_id and not studio_client;
  return jsonb_build_object('booking_id', v_id, 'card_id', v_card, 'over_limit', v_over);
end $$;
revoke execute on function public.studio_admin_add(uuid, uuid) from public, anon;
grant execute on function public.studio_admin_add(uuid, uuid) to authenticated;

create function public.studio_admin_remove(p_booking_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.studio_bookings
  set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid())
  where id = p_booking_id and status = 'booked';
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.studio_admin_remove(uuid) from public, anon;
grant execute on function public.studio_admin_remove(uuid) to authenticated;

-- Returns who was booked, so the app can tell them.
create function public.studio_cancel_session(p_session_id uuid) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_users uuid[];
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.studio_sessions set cancelled_at = now()
  where id = p_session_id and cancelled_at is null;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  with cancelled as (
    update public.studio_bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid())
    where session_id = p_session_id and status = 'booked'
    returning user_id
  )
  select coalesce(array_agg(user_id), '{}') into v_users from cancelled;
  return v_users;
end $$;
revoke execute on function public.studio_cancel_session(uuid) from public, anon;
grant execute on function public.studio_cancel_session(uuid) to authenticated;

-- After a slot edit: future trainings of that slot nobody ever booked are dropped (ensure then
-- recreates them with the new time, title or spots); booked ones stay as they were.
create function public.studio_reset_slot_sessions(p_slot_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.studio_sessions s
  where s.slot_id = p_slot_id and s.starts_at > now() and s.cancelled_at is null
    and not exists (select 1 from public.studio_bookings b where b.session_id = s.id);
end $$;
revoke execute on function public.studio_reset_slot_sessions(uuid) from public, anon;
grant execute on function public.studio_reset_slot_sessions(uuid) to authenticated;
