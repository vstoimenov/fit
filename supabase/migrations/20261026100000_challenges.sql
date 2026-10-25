-- Challenges (engagement phase 2): the owner publishes N-day challenges with one task per day; members join,
-- tick today or yesterday, earn 5 points per ticked day, and see a first-name leaderboard.
-- All dates are Europe/Sofia dates. Day d (1-based) is start_date + (d - 1); the last day is start_date + days - 1.
-- Writes: challenges and their day rows only through admin_save_challenge / admin_delete_challenge;
-- participation only through join_challenge; ticks directly, but every rule is enforced by a trigger.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 4000),
  start_date date not null check (start_date >= date '2026-01-01'),
  days smallint not null check (days between 3 and 60),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index challenges_published_start on public.challenges (start_date desc) where published;

create trigger challenges_updated_at before update on public.challenges
  for each row execute function public.set_updated_at();
create trigger challenges_audit after insert or update or delete on public.challenges
  for each row execute function public.audit_row('id');

create table public.challenge_days (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  day smallint not null check (day between 1 and 60),
  task text not null check (char_length(task) between 1 and 200),
  workout_id uuid references public.workouts (id) on delete set null,
  primary key (challenge_id, day)
);
create index challenge_days_workout on public.challenge_days (workout_id) where workout_id is not null;

-- No cascade from challenges: a challenge with participants cannot be deleted (see the guard below).
create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_on date not null,
  show_on_board boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index challenge_participants_user on public.challenge_participants (user_id);

create table public.challenge_ticks (
  challenge_id uuid not null,
  user_id uuid not null,
  day smallint not null check (day between 1 and 60),
  ticked_at timestamptz not null default now(),
  primary key (challenge_id, user_id, day),
  foreign key (challenge_id, user_id)
    references public.challenge_participants (challenge_id, user_id) on delete cascade
);
create index challenge_ticks_user on public.challenge_ticks (user_id);

-- ---------------------------------------------------------------------------------------------------------
-- Locks: once someone has joined, the schedule (start_date, days) is fixed and the challenge stays
-- (unpublish instead). Texts and workouts remain editable.
create function public.challenges_lock_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.challenge_participants p where p.challenge_id = old.id) then
      raise exception 'Предизвикателство с участнички не може да се изтрие.' using errcode = '55006';
    end if;
    return old;
  end if;
  if (new.start_date is distinct from old.start_date or new.days is distinct from old.days)
     and exists (select 1 from public.challenge_participants p where p.challenge_id = old.id) then
    raise exception 'Вече има участнички — началото и броят дни не се променят.' using errcode = '55006';
  end if;
  return new;
end $$;
revoke all on function public.challenges_lock_guard() from public, anon, authenticated;

create trigger challenges_lock_guard before update or delete on public.challenges
  for each row execute function public.challenges_lock_guard();

-- ---------------------------------------------------------------------------------------------------------
-- Tick rules, on insert and on delete (tick / untick): she is a participant, has access, the day is within
-- 1..N, not before her first day, and its date is today or yesterday. A delete that cascades from a removed
-- participant (member deleted) finds no participant row and passes.
create function public.challenge_ticks_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.challenge_ticks := case when tg_op = 'DELETE' then old else new end;
  v_today date := (now() at time zone 'Europe/Sofia')::date;
  v_joined date;
  v_start date;
  v_days smallint;
  v_access boolean;
  v_first int;
  v_date date;
begin
  select p.joined_on, c.start_date, c.days into v_joined, v_start, v_days
    from public.challenge_participants p
    join public.challenges c on c.id = p.challenge_id
    where p.challenge_id = v_row.challenge_id and p.user_id = v_row.user_id;
  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'Не си включена в предизвикателството.' using errcode = '22023';
  end if;

  v_access := case
    when v_row.user_id = (select auth.uid()) then public.my_access()
    else public.has_active_access(v_row.user_id)
  end;
  if not v_access then
    raise exception 'Нужен е активен абонамент.' using errcode = '22023';
  end if;

  if v_row.day > v_days then
    raise exception 'Този ден не е част от предизвикателството.' using errcode = '22023';
  end if;
  v_first := greatest(1, v_joined - v_start + 1);
  if v_row.day < v_first then
    raise exception 'Този ден е преди да се включиш.' using errcode = '22023';
  end if;
  v_date := v_start + (v_row.day - 1);
  if v_date > v_today or v_date < v_today - 1 then
    raise exception 'Може да отметнеш само днес и вчера.' using errcode = '22023';
  end if;

  return v_row;
end $$;
revoke all on function public.challenge_ticks_guard() from public, anon, authenticated;

create trigger challenge_ticks_guard before insert or delete on public.challenge_ticks
  for each row execute function public.challenge_ticks_guard();

-- The first tick of a (challenge, day) earns 5 points; untick never takes them back and a re-tick earns nothing.
create function public.award_challenge_points() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.points_ledger (user_id, source, ref, points)
  values (new.user_id, 'challenge', new.challenge_id::text || ':' || new.day::text, 5)
  on conflict (user_id, source, ref) do nothing;
  return new;
end $$;
revoke all on function public.award_challenge_points() from public, anon, authenticated;

create trigger challenge_ticks_points after insert on public.challenge_ticks
  for each row execute function public.award_challenge_points();

-- ---------------------------------------------------------------------------------------------------------
-- Row level security. Members with access read published challenges; a participant keeps reading hers even
-- when it is unpublished or her access has lapsed; admins read everything.
alter table public.challenges enable row level security;
create policy challenges_select on public.challenges for select to authenticated
  using (
    (select public.is_admin())
    or (published and (select public.my_access()))
    or exists (
      select 1 from public.challenge_participants p
      where p.challenge_id = challenges.id and p.user_id = (select auth.uid())
    )
  );

alter table public.challenge_days enable row level security;
create policy challenge_days_select on public.challenge_days for select to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_days.challenge_id));

alter table public.challenge_participants enable row level security;
create policy challenge_participants_select on public.challenge_participants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy challenge_participants_update on public.challenge_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The trigger carries the Bulgarian refusal messages; the insert policy repeats the access rule as a backstop.
-- Delete is limited to her own rows here and the trigger refuses it when her access has lapsed.
alter table public.challenge_ticks enable row level security;
create policy challenge_ticks_select on public.challenge_ticks for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy challenge_ticks_insert on public.challenge_ticks for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.my_access()));
create policy challenge_ticks_delete on public.challenge_ticks for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.challenges from anon, authenticated;
revoke all on public.challenge_days from anon, authenticated;
revoke all on public.challenge_participants from anon, authenticated;
revoke all on public.challenge_ticks from anon, authenticated;
grant select on public.challenges to authenticated;
grant select on public.challenge_days to authenticated;
grant select on public.challenge_participants to authenticated;
grant update (show_on_board) on public.challenge_participants to authenticated;
grant select, delete on public.challenge_ticks to authenticated;
-- ticked_at is the leaderboard tie-break: members cannot choose it.
grant insert (challenge_id, user_id, day) on public.challenge_ticks to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Admin: create / update a challenge together with its day rows. p_tasks = [{ task, workoutId }], one per day.
create function public.admin_save_challenge(
  p_id uuid,
  p_title text,
  p_description text,
  p_start date,
  p_days smallint,
  p_published boolean,
  p_tasks jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_title text := btrim(p_title);
  v_desc text := coalesce(p_description, '');
  v_id uuid;
  v_old public.challenges;
  v_texts text[] := '{}';
  v_workouts uuid[] := '{}';
  v_item jsonb;
  v_text text;
  v_wid uuid;
  v_i int;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_title is null or char_length(v_title) not between 3 and 80 then
    raise exception 'Заглавието трябва да е между 3 и 80 символа.' using errcode = '22023';
  end if;
  if char_length(v_desc) > 4000 then
    raise exception 'Описанието е до 4 000 символа.' using errcode = '22023';
  end if;
  if p_start is null or p_start < date '2026-01-01' then
    raise exception 'Началната дата не може да е преди 1 януари 2026.' using errcode = '22023';
  end if;
  if p_days is null or p_days not between 3 and 60 then
    raise exception 'Дните трябва да са между 3 и 60.' using errcode = '22023';
  end if;
  if p_published is null then
    raise exception 'Липсва статус на публикуване.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tasks) is distinct from 'array' or jsonb_array_length(p_tasks) <> p_days then
    raise exception 'Нужна е по една задача за всеки ден.' using errcode = '22023';
  end if;

  for v_i in 0 .. p_days - 1 loop
    v_item := p_tasks -> v_i;
    if jsonb_typeof(v_item) is distinct from 'object' or jsonb_typeof(v_item -> 'task') is distinct from 'string' then
      raise exception 'Ден %: липсва задача.', v_i + 1 using errcode = '22023';
    end if;
    v_text := btrim(v_item ->> 'task');
    if char_length(v_text) not between 1 and 200 then
      raise exception 'Ден %: задачата е между 1 и 200 символа.', v_i + 1 using errcode = '22023';
    end if;

    v_wid := null;
    if jsonb_typeof(v_item -> 'workoutId') = 'string' then
      if (v_item ->> 'workoutId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Ден %: невалидна тренировка.', v_i + 1 using errcode = '22023';
      end if;
      v_wid := (v_item ->> 'workoutId')::uuid;
      if not exists (
        select 1 from public.workouts w
        where w.id = v_wid and w.publish_at is not null and w.publish_at <= now()
      ) then
        raise exception 'Ден %: тренировката не е публикувана.', v_i + 1 using errcode = '22023';
      end if;
    elsif jsonb_typeof(v_item -> 'workoutId') not in ('null') and v_item ? 'workoutId' then
      raise exception 'Ден %: невалидна тренировка.', v_i + 1 using errcode = '22023';
    end if;

    v_texts := v_texts || v_text;
    v_workouts := v_workouts || v_wid;
  end loop;

  if p_id is null then
    insert into public.challenges (title, description, start_date, days, published)
    values (v_title, v_desc, p_start, p_days, p_published)
    returning id into v_id;
  else
    -- Row lock: a join (its foreign-key check) waits for this transaction, so the participant check below
    -- cannot be overtaken by a new participant.
    select * into v_old from public.challenges c where c.id = p_id for update;
    if not found then
      raise exception 'Предизвикателството не е намерено.' using errcode = 'P0002';
    end if;
    if (p_start is distinct from v_old.start_date or p_days is distinct from v_old.days)
       and exists (select 1 from public.challenge_participants p where p.challenge_id = p_id) then
      raise exception 'Вече има участнички — началото и броят дни не се променят.' using errcode = '55006';
    end if;
    update public.challenges
      set title = v_title, description = v_desc, start_date = p_start, days = p_days, published = p_published
      where id = p_id;
    v_id := p_id;
    delete from public.challenge_days where challenge_id = v_id;
  end if;

  insert into public.challenge_days (challenge_id, day, task, workout_id)
  select v_id, d.n::smallint, v_texts[d.n], v_workouts[d.n]
  from generate_series(1, p_days) as d (n);

  return v_id;
end $$;
revoke execute on function public.admin_save_challenge(uuid, text, text, date, smallint, boolean, jsonb) from public, anon;
grant execute on function public.admin_save_challenge(uuid, text, text, date, smallint, boolean, jsonb) to authenticated;

create function public.admin_delete_challenge(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.challenges c where c.id = p_id for update;
  if not found then
    raise exception 'Предизвикателството не е намерено.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.challenge_participants p where p.challenge_id = p_id) then
    raise exception 'Предизвикателство с участнички не може да се изтрие.' using errcode = '55006';
  end if;
  delete from public.challenges where id = p_id;
end $$;
revoke execute on function public.admin_delete_challenge(uuid) from public, anon;
grant execute on function public.admin_delete_challenge(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Member: join. Needs access, a challenge she can see, and that it has not ended. joined_on = today, or the
-- start date when joining early. Joining twice changes nothing.
create function public.join_challenge(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/Sofia')::date;
  v_start date;
  v_days smallint;
  v_published boolean;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Key-share lock: waits for an in-flight admin_save_challenge on the same row and re-reads its result.
  select c.start_date, c.days, c.published into v_start, v_days, v_published
    from public.challenges c where c.id = p_id for key share;
  if not found then
    raise exception 'Предизвикателството не е намерено.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.challenge_participants p where p.challenge_id = p_id and p.user_id = v_uid
  ) then
    return;
  end if;
  if not public.my_access() then
    raise exception 'Нужен е активен абонамент.' using errcode = '22023';
  end if;
  if not (v_published or public.is_admin()) then
    raise exception 'Предизвикателството не е намерено.' using errcode = 'P0002';
  end if;
  if v_today > v_start + v_days - 1 then
    raise exception 'Предизвикателството вече приключи.' using errcode = '22023';
  end if;
  insert into public.challenge_participants (challenge_id, user_id, joined_on)
  values (p_id, v_uid, greatest(v_today, v_start))
  on conflict (challenge_id, user_id) do nothing;
end $$;
revoke execute on function public.join_challenge(uuid) from public, anon;
grant execute on function public.join_challenge(uuid) to authenticated;

-- Participant counts for a list of challenges (only those the caller may see).
create function public.challenge_counts(p_ids uuid[]) returns table (challenge_id uuid, participants int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'too many ids' using errcode = '22023';
  end if;
  return query
    select c.id, (select count(*)::int from public.challenge_participants p where p.challenge_id = c.id)
    from public.challenges c
    where c.id = any (p_ids)
      and (
        public.is_admin()
        or (c.published and public.my_access())
        or exists (select 1 from public.challenge_participants m where m.challenge_id = c.id and m.user_id = v_uid)
      );
end $$;
revoke execute on function public.challenge_counts(uuid[]) from public, anon;
grant execute on function public.challenge_counts(uuid[]) to authenticated;

-- Leaderboard: all participants ordered by ticked days (desc), then whoever reached that count first. Returns
-- the top 10 plus the caller's own row. Names are first name + initial of the second word ("Мария П."), just
-- the first word when there is no second one, and "Участничка" when she opted out or has no name. Never the
-- surname or the email.
create function public.challenge_board(p_id uuid)
returns table (rank int, display_name text, ticked int, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (
    public.is_admin()
    or exists (select 1 from public.challenge_participants m where m.challenge_id = p_id and m.user_id = v_uid)
    or exists (select 1 from public.challenges c where c.id = p_id and c.published and public.my_access())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with stats as (
      select p.user_id as uid,
             p.show_on_board as shown,
             regexp_split_to_array(regexp_replace(pr.name, '^\s+|\s+$', '', 'g'), '\s+') as parts,
             count(t.day)::int as cnt,
             max(t.ticked_at) as last_at
      from public.challenge_participants p
      join public.profiles pr on pr.id = p.user_id
      left join public.challenge_ticks t on t.challenge_id = p.challenge_id and t.user_id = p.user_id
      where p.challenge_id = p_id
      group by p.user_id, p.show_on_board, pr.name
    ),
    ranked as (
      select s.*, (row_number() over (order by s.cnt desc, s.last_at asc nulls last, s.uid))::int as rk
      from stats s
    )
    select r.rk,
           case
             when not r.shown or coalesce(r.parts[1], '') = '' then 'Участничка'
             when r.parts[2] is null then r.parts[1]
             else r.parts[1] || ' ' || left(r.parts[2], 1) || '.'
           end,
           r.cnt,
           r.uid = v_uid
    from ranked r
    where r.rk <= 10 or r.uid = v_uid
    order by r.rk;
end $$;
revoke execute on function public.challenge_board(uuid) from public, anon;
grant execute on function public.challenge_board(uuid) to authenticated;
