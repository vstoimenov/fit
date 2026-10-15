-- Two admins reordering the starter week at once could interleave their row updates and hit the
-- partial unique index on starter_order. Take a table lock that conflicts with itself (but not with
-- plain reads) so concurrent reorders run one after another. Same body as before otherwise.
create or replace function public.admin_reorder_starters(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i int;
  n int := coalesce(array_length(p_ids, 1), 0);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  lock table public.workouts in share row exclusive mode;
  if n <> (select count(*) from public.workouts where kind = 'starter')
     or n <> (select count(distinct x) from unnest(p_ids) as x)
     or exists (
       select 1 from unnest(p_ids) as x
       where not exists (select 1 from public.workouts w where w.id = x and w.kind = 'starter')
     )
  then
    raise exception 'reorder must list every starter workout exactly once' using errcode = '22023';
  end if;
  update public.workouts set starter_order = -starter_order where kind = 'starter';
  for i in 1 .. n loop
    update public.workouts set starter_order = i where id = p_ids[i];
  end loop;
end $$;
revoke execute on function public.admin_reorder_starters(uuid[]) from public, anon;
grant execute on function public.admin_reorder_starters(uuid[]) to authenticated;
