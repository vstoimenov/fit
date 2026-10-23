-- Nutrition diary: the member's nutrition answers (on profiles), her food entries and the AI-estimate
-- quota. Everything is written under public.my_access(); without access the diary is read-only.
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active');
create type public.diet_type as enum ('omnivore', 'vegetarian', 'vegan', 'pescatarian');
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.food_source as enum ('ai', 'manual', 'recent', 'menu');

-- Nutrition answers. They count as health data (same consent as height and weight). The upper bound of
-- birth_year (current year - 16) moves with the calendar, so the application checks it; the database only
-- keeps the static range.
alter table public.profiles
  add column birth_year smallint check (birth_year between 1940 and 2100),
  add column activity_level public.activity_level,
  add column diet public.diet_type,
  add column allergens text[] not null default '{}'
    check (allergens <@ array[
      'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
      'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'
    ]::text[]),
  add column avoid_foods text check (char_length(avoid_foods) <= 200),
  add column meals_per_day smallint check (meals_per_day between 3 and 5),
  add column nutrition_answered_at timestamptz;

-- Same column list as the foundation grant plus the new answers; role and the rest stay server-side.
grant update (
  birth_year, activity_level, diet, allergens, avoid_foods, meals_per_day, nutrition_answered_at
) on public.profiles to authenticated;

-- One row per eaten item. A save sends all rows of one add flow with the same batch_id and the item's
-- position, so a retried request conflicts instead of doubling the day (two items with the same name in
-- one batch are legitimately different positions).
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null,
  position smallint not null check (position between 0 and 99),
  eaten_on date not null,
  meal public.meal_slot not null,
  name text not null check (char_length(name) between 1 and 120),
  grams numeric(6, 1) check (grams between 1 and 2000),
  kcal integer not null check (kcal between 0 and 5000),
  protein_g numeric(6, 1) not null check (protein_g between 0 and 1000),
  carbs_g numeric(6, 1) not null check (carbs_g between 0 and 1000),
  fat_g numeric(6, 1) not null check (fat_g between 0 and 1000),
  source public.food_source not null,
  created_at timestamptz not null default now(),
  unique (user_id, batch_id, position)
);
create index food_entries_user_day on public.food_entries (user_id, eaten_on);

-- The date window (Europe/Sofia) and the 100-per-day cap. Runs on insert only: the member cannot move an
-- entry to another day (column grants below), and editing an old entry's amounts must keep working.
-- Serialised per member so concurrent inserts cannot slip past the cap.
create function public.food_entries_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Sofia')::date;
begin
  if new.eaten_on > v_today then
    raise exception 'Датата трябва да е до днес.' using errcode = '22023';
  end if;
  if new.eaten_on < v_today - 365 then
    raise exception 'Датата е твърде стара.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('food_entries:' || new.user_id::text));

  if (select count(*) from public.food_entries e
      where e.user_id = new.user_id and e.eaten_on = new.eaten_on) >= 100 then
    raise exception 'Достигна 100 записа за деня.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.food_entries_guard() from public, anon, authenticated;

create trigger food_entries_guard before insert on public.food_entries
  for each row execute function public.food_entries_guard();

alter table public.food_entries enable row level security;
create policy food_entries_select on public.food_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy food_entries_insert on public.food_entries for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.my_access()));
create policy food_entries_update on public.food_entries for update to authenticated
  using (user_id = (select auth.uid()) and (select public.my_access()))
  with check (user_id = (select auth.uid()) and (select public.my_access()));
create policy food_entries_delete on public.food_entries for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.my_access()));

-- She may correct only what she ate and how much; who, when, which meal and where it came from are fixed.
revoke all on public.food_entries from anon, authenticated;
grant select, insert, delete on public.food_entries to authenticated;
grant update (name, grams, kcal, protein_g, carbs_g, fat_g) on public.food_entries to authenticated;

-- One row per AI estimate, no text stored. Only claim_nutrition_ai_call writes it.
create table public.nutrition_ai_calls (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  called_at timestamptz not null default now()
);
create index nutrition_ai_calls_user_called on public.nutrition_ai_calls (user_id, called_at);

alter table public.nutrition_ai_calls enable row level security;
revoke all on public.nutrition_ai_calls from anon, authenticated;

-- Takes one of the member's 60 estimates for the Sofia day. False (and nothing recorded) without access
-- or once the day's quota is used up. Serialised per member so parallel calls cannot overshoot 60.
create function public.claim_nutrition_ai_call() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_since timestamptz := date_trunc('day', now() at time zone 'Europe/Sofia') at time zone 'Europe/Sofia';
begin
  if v_uid is null or not public.my_access() then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('nutrition_ai_calls:' || v_uid::text));

  if (select count(*) from public.nutrition_ai_calls c
      where c.user_id = v_uid and c.called_at >= v_since) >= 60 then
    return false;
  end if;
  insert into public.nutrition_ai_calls (user_id) values (v_uid);
  return true;
end $$;
revoke all on function public.claim_nutrition_ai_call() from public, anon, authenticated;
grant execute on function public.claim_nutrition_ai_call() to authenticated;
