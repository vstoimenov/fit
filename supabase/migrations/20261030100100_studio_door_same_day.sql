-- The trainer can add a walk-in until the end of the training's day, not only until it ends.
create or replace function public.studio_admin_add(p_session_id uuid, p_user_id uuid) returns jsonb
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
  -- „На вратата“ works until the end of the training's day (she may tick a walk-in afterwards).
  if (now() at time zone 'Europe/Sofia')::date > (s.starts_at at time zone 'Europe/Sofia')::date then
    raise exception 'past day' using errcode = 'P0001';
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
