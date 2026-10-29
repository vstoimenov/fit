-- Punch cards: the trainer gives one after the client has paid on site, voids a mistake, or
-- corrects the count with a visible reason.

create function public.studio_grant_card(
  p_user_id uuid, p_kind text, p_starts_on date, p_used_before int default 0
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_visits int;
  v_weeks int;
  v_card uuid;
  v_moved int := 0;
  b record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  case p_kind
    when 'card8' then v_visits := 8; v_weeks := 4;
    when 'card12' then v_visits := 12; v_weeks := 6;
    else raise exception 'unknown card' using errcode = 'P0001';
  end case;
  if p_used_before is null or p_used_before < 0 or p_used_before >= v_visits then
    raise exception 'used before out of range' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'client not found' using errcode = 'P0002';
  end if;
  insert into public.studio_cards (user_id, kind, visits, starts_on, ends_on, used_before, created_by)
  values (p_user_id, p_kind, v_visits, p_starts_on, p_starts_on + (v_weeks * 7 - 1), p_used_before,
    (select auth.uid()))
  returning id into v_card;

  -- Her „7 € на място“ bookings inside the card's dates move onto it, oldest first.
  for b in
    select bk.id
    from public.studio_bookings bk
    join public.studio_sessions s on s.id = bk.session_id
    where bk.user_id = p_user_id and bk.status = 'booked' and bk.card_id is null
      and s.cancelled_at is null
      and (s.starts_at at time zone 'Europe/Sofia')::date between p_starts_on
        and p_starts_on + (v_weeks * 7 - 1)
    order by s.starts_at, bk.id
    limit v_visits - p_used_before
    for update of bk
  loop
    update public.studio_bookings set card_id = v_card where id = b.id;
    v_moved := v_moved + 1;
  end loop;

  update public.profiles set studio_client = true where id = p_user_id and not studio_client;
  return jsonb_build_object('card_id', v_card, 'moved', v_moved);
end $$;
revoke execute on function public.studio_grant_card(uuid, text, date, int) from public, anon;
grant execute on function public.studio_grant_card(uuid, text, date, int) to authenticated;

create function public.studio_void_card(p_card_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.studio_cards where id = p_card_id and voided_at is null for update;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.studio_bookings where card_id = p_card_id and status = 'booked'
  ) then
    raise exception 'card in use' using errcode = 'P0001';
  end if;
  update public.studio_cards set voided_at = now() where id = p_card_id;
end $$;
revoke execute on function public.studio_void_card(uuid) from public, anon;
grant execute on function public.studio_void_card(uuid) to authenticated;

create function public.studio_adjust_card(p_card_id uuid, p_delta int, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_remaining int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.studio_cards where id = p_card_id and voided_at is null for update;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  select remaining into v_remaining from public.studio_card_status where id = p_card_id;
  if v_remaining + p_delta < 0 then
    raise exception 'negative' using errcode = 'P0001';
  end if;
  insert into public.studio_card_adjustments (card_id, delta, reason, created_by)
  values (p_card_id, p_delta, btrim(p_reason), (select auth.uid()));
end $$;
revoke execute on function public.studio_adjust_card(uuid, int, text) from public, anon;
grant execute on function public.studio_adjust_card(uuid, int, text) to authenticated;
