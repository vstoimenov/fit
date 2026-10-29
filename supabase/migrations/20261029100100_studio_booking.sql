-- Booking and cancelling. The session row is locked first, so two clients can never take the same
-- last spot; the client's cards are locked before one is picked, so a visit is never spent twice.

-- The card a booking on p_day uses: valid that day, visits left, the one ending first.
create function public.studio_pick_card(p_user uuid, p_day date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_card uuid;
begin
  perform 1 from public.studio_cards c
  where c.user_id = p_user and c.voided_at is null and p_day between c.starts_on and c.ends_on
  for update;
  select s.id into v_card
  from public.studio_card_status s
  where s.user_id = p_user and s.voided_at is null and p_day between s.starts_on and s.ends_on
    and s.remaining > 0
  order by s.ends_on, s.created_at, s.id
  limit 1;
  return v_card;
end $$;
revoke execute on function public.studio_pick_card(uuid, date) from public, anon, authenticated;

create function public.studio_book(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  s public.studio_sessions%rowtype;
  v_card uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.studio_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if s.cancelled_at is not null then
    raise exception 'session cancelled' using errcode = 'P0001';
  end if;
  if now() >= s.starts_at then
    raise exception 'started' using errcode = 'P0001';
  end if;
  if s.starts_at > now() + interval '14 days' then
    raise exception 'not open' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.studio_bookings b
    where b.session_id = s.id and b.user_id = v_uid and b.status = 'booked'
  ) then
    raise exception 'already booked' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.studio_bookings b where b.session_id = s.id and b.status = 'booked'
  ) >= s.capacity then
    raise exception 'full' using errcode = 'P0001';
  end if;
  v_card := public.studio_pick_card(v_uid, (s.starts_at at time zone 'Europe/Sofia')::date);
  insert into public.studio_bookings (session_id, user_id, card_id, source)
  values (s.id, v_uid, v_card, 'client')
  returning id into v_id;
  update public.profiles set studio_client = true where id = v_uid and not studio_client;
  return jsonb_build_object('booking_id', v_id, 'card_id', v_card);
end $$;
revoke execute on function public.studio_book(uuid) from public, anon;
grant execute on function public.studio_book(uuid) to authenticated;

-- Her own booking, until 6 hours before the start; the visit goes back to the card.
create function public.studio_cancel(p_booking_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_starts timestamptz;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select s.starts_at into v_starts
  from public.studio_bookings b
  join public.studio_sessions s on s.id = b.session_id
  where b.id = p_booking_id and b.user_id = v_uid and b.status = 'booked'
  for update of b;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if now() > v_starts - interval '6 hours' then
    raise exception 'too late' using errcode = 'P0001';
  end if;
  update public.studio_bookings
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid
  where id = p_booking_id;
end $$;
revoke execute on function public.studio_cancel(uuid) from public, anon;
grant execute on function public.studio_cancel(uuid) to authenticated;
