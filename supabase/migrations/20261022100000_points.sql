-- Points & levels (engagement phase 1). Append-only ledger: members only read it; every award comes
-- from a security-definer trigger or admin function, and each one is idempotent through
-- unique (user_id, source, ref).
create type public.points_source as enum ('workout', 'checkin', 'challenge', 'live', 'post', 'comment', 'admin');

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source public.points_source not null,
  ref text not null check (char_length(ref) between 1 and 80),
  points integer not null check (points between -10000 and 10000),
  reason text check (char_length(reason) <= 200),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (user_id, source, ref)
);
create index points_ledger_user_created on public.points_ledger (user_id, created_at desc);

-- Level thresholds (total points): 1:0 2:50 3:120 4:220 5:350 6:520 7:730 8:980 9:1270 10:1600.
-- Mirrored in TypeScript and pinned by a parity test.
create function public.level_for_points(p int) returns int
language sql immutable security definer set search_path = '' as $$
  select case
    when p >= 1600 then 10
    when p >= 1270 then 9
    when p >= 980 then 8
    when p >= 730 then 7
    when p >= 520 then 6
    when p >= 350 then 5
    when p >= 220 then 4
    when p >= 120 then 3
    when p >= 50 then 2
    else 1
  end;
$$;
revoke execute on function public.level_for_points(int) from public, anon;
grant execute on function public.level_for_points(int) to authenticated;

-- A member may read only her own total; admins may read anyone's.
create function public.member_points(uid uuid) returns table (points int, level int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_total int;
begin
  if uid is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(sum(l.points), 0)::int into v_total
    from public.points_ledger l where l.user_id = uid;
  return query select v_total, public.level_for_points(v_total);
end $$;
revoke execute on function public.member_points(uuid) from public, anon;
grant execute on function public.member_points(uuid) to authenticated;

-- Awards. Completed workouts earn 10 once per day (ref = 'YYYY-MM-DD' of completed_at in Europe/Sofia,
-- server time — not the member's profile timezone — so extra workouts in a day cannot farm points); a
-- check-in earns 5 once per ISO week in Europe/Sofia (ref = 'YYYY-Www'). Deleting the source row never
-- claws points back.
create function public.award_workout_points() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.points_ledger (user_id, source, ref, points)
  values (new.user_id, 'workout', to_char(new.completed_at at time zone 'Europe/Sofia', 'YYYY-MM-DD'), 10)
  on conflict (user_id, source, ref) do nothing;
  return new;
end $$;

create trigger workout_completions_points after insert on public.workout_completions
  for each row execute function public.award_workout_points();

create function public.award_checkin_points() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.points_ledger (user_id, source, ref, points)
  values (new.user_id, 'checkin', to_char(new.created_at at time zone 'Europe/Sofia', 'IYYY-"W"IW'), 5)
  on conflict (user_id, source, ref) do nothing;
  return new;
end $$;

create trigger check_ins_points after insert on public.check_ins
  for each row execute function public.award_checkin_points();

revoke execute on function public.award_workout_points() from public, anon, authenticated;
revoke execute on function public.award_checkin_points() from public, anon, authenticated;

-- Backfill: existing completions and check-ins earn their points once (same rules as the triggers).
insert into public.points_ledger (user_id, source, ref, points, created_at)
select d.user_id, 'workout', d.day, 10, d.first_at
from (
  select c.user_id,
         to_char(c.completed_at at time zone 'Europe/Sofia', 'YYYY-MM-DD') as day,
         min(c.completed_at) as first_at
  from public.workout_completions c
  group by 1, 2
) d
on conflict (user_id, source, ref) do nothing;

insert into public.points_ledger (user_id, source, ref, points, created_at)
select k.user_id, 'checkin', k.week, 5, k.first_at
from (
  select ci.user_id,
         to_char(ci.created_at at time zone 'Europe/Sofia', 'IYYY-"W"IW') as week,
         min(ci.created_at) as first_at
  from public.check_ins ci
  group by 1, 2
) k
on conflict (user_id, source, ref) do nothing;

-- Manual correction by an admin (positive or negative), always with a reason.
create function public.admin_adjust_points(p_user_id uuid, p_points int, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := btrim(p_reason);
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) < 1 or char_length(v_reason) > 200 then
    raise exception 'reason must be 1..200 characters' using errcode = '22023';
  end if;
  if p_points is null or p_points = 0 or p_points < -10000 or p_points > 10000 then
    raise exception 'points must be non-zero and within -10000..10000' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  insert into public.points_ledger (user_id, source, ref, points, reason, created_by)
  values (p_user_id, 'admin', gen_random_uuid()::text, p_points, v_reason, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.admin_adjust_points(uuid, int, text) from public, anon;
grant execute on function public.admin_adjust_points(uuid, int, text) to authenticated;

-- Admin adjustments (and any service-role edit or delete) are audited; automatic awards are not,
-- so the audit log is not flooded by every workout.
create trigger points_ledger_audit_insert after insert on public.points_ledger
  for each row when (new.source = 'admin') execute function public.audit_row('id');
create trigger points_ledger_audit_change after update or delete on public.points_ledger
  for each row execute function public.audit_row('id');

alter table public.points_ledger enable row level security;
create policy points_ledger_select on public.points_ledger for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- No insert/update/delete policies: the ledger is written only by security-definer code.
revoke all on public.points_ledger from anon, authenticated;
grant select on public.points_ledger to authenticated;

-- Manual rewards (levels 4, 8, 10) handed out by the owner.
create table public.rewards_given (
  user_id uuid not null references public.profiles (id) on delete cascade,
  level smallint not null check (level in (4, 8, 10)),
  given_at timestamptz not null default now(),
  given_by uuid default auth.uid(),
  note text check (char_length(note) <= 300),
  primary key (user_id, level)
);

create trigger rewards_given_audit after insert or update or delete on public.rewards_given
  for each row execute function public.audit_row('user_id');

alter table public.rewards_given enable row level security;
create policy rewards_given_select on public.rewards_given for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy rewards_given_admin_insert on public.rewards_given for insert to authenticated
  with check ((select public.is_admin()));
create policy rewards_given_admin_update on public.rewards_given for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy rewards_given_admin_delete on public.rewards_given for delete to authenticated
  using ((select public.is_admin()));
revoke all on public.rewards_given from anon, authenticated;
grant select, insert, update, delete on public.rewards_given to authenticated;

-- Exclusive workouts: below min_member_level the workout is listed but its video is not served.
alter table public.workouts
  add column min_member_level smallint check (min_member_level between 2 and 10);

-- Same as 20261014100100_content.sql, plus the member-level gate (admins unaffected).
create or replace function public.can_watch(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id
      and (
        public.is_admin()
        or (
          w.publish_at is not null and w.publish_at <= now()
          and (w.kind = 'free' or public.has_active_access((select auth.uid())))
        )
      )
      and (
        w.min_member_level is null
        or public.is_admin()
        or (select mp.level from public.member_points((select auth.uid())) mp) >= w.min_member_level
      )
  );
$$;
revoke execute on function public.can_watch(uuid) from public, anon;
grant execute on function public.can_watch(uuid) to authenticated;
