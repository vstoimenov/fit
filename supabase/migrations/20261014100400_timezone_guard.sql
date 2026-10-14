-- 1a. An invalid timezone must never be stored: it would break completion dating.
create function public.validate_profile_timezone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown time zone: %', new.timezone using errcode = '23514';
  end if;
  return new;
end $$;

create trigger profiles_validate_timezone before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

revoke execute on function public.validate_profile_timezone() from public, anon, authenticated;

-- 1b. Belt and braces: a bad or missing zone falls back to Sofia instead of blocking the completion.
create or replace function public.completion_local_date() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    select (new.completed_at at time zone p.timezone)::date into new.local_date
    from public.profiles p where p.id = new.user_id;
  exception when invalid_parameter_value then
    new.local_date := null;
  end;
  if new.local_date is null then
    new.local_date := (new.completed_at at time zone 'Europe/Sofia')::date;
  end if;
  return new;
end $$;

-- 2. Tables created later by the postgres role must not hand these privileges to API roles either.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;

-- 3. Only published starters count towards finishing the starter week (consistent with the total).
create or replace function public.mark_starter_week_done() returns trigger
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
    where c.user_id = new.user_id and w.kind = 'starter'
      and w.publish_at is not null and w.publish_at <= now();
  if total > 0 and done >= total then
    update public.profiles set starter_week_done_at = coalesce(starter_week_done_at, now())
      where id = new.user_id;
  end if;
  return new;
end $$;
