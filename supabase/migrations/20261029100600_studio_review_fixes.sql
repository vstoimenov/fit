-- A slot edit also moves future trainings whose bookings were all cancelled (only active bookings
-- pin a training to its old time). Their cancelled booking rows hold no visit and go with them;
-- the audit log keeps the history.
create or replace function public.studio_reset_slot_sessions(p_slot_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.studio_bookings b
  where b.status = 'cancelled' and b.session_id in (
    select s.id from public.studio_sessions s
    where s.slot_id = p_slot_id and s.starts_at > now() and s.cancelled_at is null
      and not exists (
        select 1 from public.studio_bookings x where x.session_id = s.id and x.status = 'booked'
      )
  );
  delete from public.studio_sessions s
  where s.slot_id = p_slot_id and s.starts_at > now() and s.cancelled_at is null
    and not exists (select 1 from public.studio_bookings b where b.session_id = s.id);
end $$;
revoke execute on function public.studio_reset_slot_sessions(uuid) from public, anon;
grant execute on function public.studio_reset_slot_sessions(uuid) to authenticated;
