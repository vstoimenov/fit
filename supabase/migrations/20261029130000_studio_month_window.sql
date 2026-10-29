-- The schedule on /zala is a month calendar: booking opens 31 days ahead (was 14).
create or replace function public.studio_book(p_session_id uuid) returns jsonb
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
  if s.starts_at > now() + interval '31 days' then
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
