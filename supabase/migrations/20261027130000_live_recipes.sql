-- Phase 3: live sessions with Аксения (join window + 5 points once) and recipes as an article category.
alter table public.articles
  add column category text not null default 'article' check (category in ('article', 'recipe'));

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  starts_at timestamptz not null,
  duration_min smallint not null default 60 check (duration_min between 15 and 180),
  join_url text not null check (join_url ~ '^https://' and char_length(join_url) <= 500),
  recording_url text check (recording_url is null or (recording_url ~ '^https://' and char_length(recording_url) <= 500)),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_sessions_starts on public.live_sessions (starts_at desc);
create trigger live_sessions_updated_at before update on public.live_sessions
  for each row execute function public.set_updated_at();
create trigger live_sessions_audit after insert or update or delete on public.live_sessions
  for each row execute function public.audit_row('id');

create table public.live_attendance (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Attendance is history: a session with attendance cannot be deleted (unpublish it instead).
  session_id uuid not null references public.live_sessions (id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
create index live_attendance_session on public.live_attendance (session_id);

alter table public.live_sessions enable row level security;
create policy live_sessions_select on public.live_sessions for select to authenticated
  using ((select public.is_admin()) or (published and (select public.my_access())));
create policy live_sessions_admin_insert on public.live_sessions for insert to authenticated
  with check ((select public.is_admin()));
create policy live_sessions_admin_update on public.live_sessions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy live_sessions_admin_delete on public.live_sessions for delete to authenticated
  using ((select public.is_admin()));

alter table public.live_attendance enable row level security;
create policy live_attendance_select on public.live_attendance for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.live_sessions from anon, authenticated;
revoke all on public.live_attendance from anon, authenticated;
grant select on public.live_sessions to authenticated;
grant insert (title, description, starts_at, duration_min, join_url, recording_url, published)
  on public.live_sessions to authenticated;
grant update (title, description, starts_at, duration_min, join_url, recording_url, published)
  on public.live_sessions to authenticated;
grant delete on public.live_sessions to authenticated;
grant select on public.live_attendance to authenticated;

-- „Влизам": once per session, from 15 minutes before the start until the end; members with access only.
create function public.attend_live(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  s public.live_sessions%rowtype;
begin
  if v_uid is null or not public.my_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.live_sessions where id = p_session_id and published;
  if not found then
    raise exception 'Сесията не е намерена.' using errcode = 'P0002';
  end if;
  if now() < s.starts_at - interval '15 minutes' then
    raise exception 'Сесията още не е започнала.' using errcode = 'P0001';
  end if;
  if now() >= s.starts_at + make_interval(mins => s.duration_min) then
    raise exception 'Сесията вече приключи.' using errcode = 'P0001';
  end if;
  insert into public.live_attendance (user_id, session_id) values (v_uid, p_session_id)
  on conflict do nothing;
end $$;
revoke execute on function public.attend_live(uuid) from public, anon;
grant execute on function public.attend_live(uuid) to authenticated;

create function public.award_live_points() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.points_ledger (user_id, source, ref, points)
  values (new.user_id, 'live', new.session_id::text, 5)
  on conflict (user_id, source, ref) do nothing;
  return new;
end $$;
revoke all on function public.award_live_points() from public, anon, authenticated;
create trigger live_attendance_points after insert on public.live_attendance
  for each row execute function public.award_live_points();
