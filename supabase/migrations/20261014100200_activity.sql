create table public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  completed_at timestamptz not null default now(),
  -- Placeholder default keeps the column optional in generated Insert types; the trigger below always overwrites it.
  local_date date not null default current_date,
  feeling public.feeling,
  unique (user_id, workout_id, local_date)
);
create index workout_completions_user_date on public.workout_completions (user_id, local_date desc);

-- local_date is the calendar day in the user's own timezone; never trusted from the client.
create function public.completion_local_date() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select (new.completed_at at time zone p.timezone)::date into new.local_date
  from public.profiles p where p.id = new.user_id;
  if new.local_date is null then
    new.local_date := (new.completed_at at time zone 'Europe/Sofia')::date;
  end if;
  return new;
end $$;

create trigger workout_completions_local_date before insert on public.workout_completions
  for each row execute function public.completion_local_date();

-- Finishing the last published starter workout ends the starter week.
create function public.mark_starter_week_done() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total int;
  done int;
begin
  if (select kind from public.workouts where id = new.workout_id) <> 'starter' then
    return new;
  end if;
  select count(*) into total from public.workouts
    where kind = 'starter' and publish_at is not null and publish_at <= now();
  select count(distinct c.workout_id) into done
    from public.workout_completions c join public.workouts w on w.id = c.workout_id
    where c.user_id = new.user_id and w.kind = 'starter';
  if total > 0 and done >= total then
    update public.profiles set starter_week_done_at = coalesce(starter_week_done_at, now())
      where id = new.user_id;
  end if;
  return new;
end $$;

create trigger workout_completions_starter after insert on public.workout_completions
  for each row execute function public.mark_starter_week_done();

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 250),
  waist_cm numeric(5, 1) check (waist_cm between 40 and 200),
  hips_cm numeric(5, 1) check (hips_cm between 50 and 220),
  energy smallint check (energy between 1 and 5),
  mood smallint check (mood between 1 and 5),
  note text check (char_length(note) <= 500),
  constraint check_ins_not_empty check (
    coalesce(weight_kg, waist_cm, hips_cm, energy, mood) is not null or note is not null
  )
);
create index check_ins_user_created on public.check_ins (user_id, created_at desc);

create table public.visits (
  id bigint generated always as identity primary key,
  anon_id uuid not null,
  user_id uuid references public.profiles (id) on delete set null,
  path text not null check (char_length(path) <= 300),
  referrer text check (char_length(referrer) <= 500),
  utm jsonb,
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  created_at timestamptz not null default now()
);
create index visits_created on public.visits (created_at desc);
create index visits_user on public.visits (user_id, created_at desc);

alter table public.workout_completions enable row level security;
alter table public.check_ins enable row level security;
alter table public.visits enable row level security;

create policy completions_select on public.workout_completions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy completions_insert on public.workout_completions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_watch(workout_id));
create policy completions_update on public.workout_completions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy check_ins_select on public.check_ins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy check_ins_insert on public.check_ins for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy check_ins_delete on public.check_ins for delete to authenticated
  using (user_id = (select auth.uid()));

create policy visits_select on public.visits for select to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.workout_completions, public.check_ins, public.visits
  from anon, authenticated;
grant insert (workout_id, feeling) on public.workout_completions to authenticated;
grant update (feeling) on public.workout_completions to authenticated;
grant insert (weight_kg, waist_cm, hips_cm, energy, mood, note) on public.check_ins to authenticated;
grant delete on public.check_ins to authenticated;

-- Trigger functions are only ever invoked by their triggers; nobody should call them over RPC.
revoke execute on function public.completion_local_date() from public, anon, authenticated;
revoke execute on function public.mark_starter_week_done() from public, anon, authenticated;
