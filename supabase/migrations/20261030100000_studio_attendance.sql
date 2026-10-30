-- „Днес“: the trainer ticks who came. Information only: the visit was already taken at booking.
alter table public.studio_bookings add column attended_at timestamptz;

create function public.studio_set_attended(p_booking_id uuid, p_attended boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.studio_bookings
  set attended_at = case when p_attended then coalesce(attended_at, now()) end
  where id = p_booking_id and status = 'booked';
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.studio_set_attended(uuid, boolean) from public, anon;
grant execute on function public.studio_set_attended(uuid, boolean) to authenticated;
