-- A member's own "Гледано" marks: one row per workout, independent of the points-earning completion.
create table public.workout_watches (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  watched_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);
create index workout_watches_workout on public.workout_watches (workout_id);

alter table public.workout_watches enable row level security;

create policy watches_select on public.workout_watches for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy watches_insert on public.workout_watches for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_watch(workout_id));
create policy watches_delete on public.workout_watches for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.workout_watches from anon;
revoke insert, update, delete on public.workout_watches from authenticated;
grant insert (workout_id) on public.workout_watches to authenticated;
grant delete on public.workout_watches to authenticated;

-- Finishing a workout for points also counts as having watched it.
create function public.mark_watched_on_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workout_watches (user_id, workout_id)
  values (new.user_id, new.workout_id)
  on conflict (user_id, workout_id) do nothing;
  return new;
end $$;
revoke execute on function public.mark_watched_on_completion() from public, anon, authenticated;

create trigger workout_completions_watched after insert on public.workout_completions
  for each row execute function public.mark_watched_on_completion();

-- Workouts completed before this table existed count as watched too.
insert into public.workout_watches (user_id, workout_id)
select distinct user_id, workout_id from public.workout_completions
on conflict (user_id, workout_id) do nothing;
