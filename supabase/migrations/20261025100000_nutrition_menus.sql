-- Nutrition menus: the owner's meal catalogue, the member's per-day swaps and the admin AI-draft quota.
-- Members read published meals (with access); only admins write meals; a member writes only her own swaps.

-- CHECK constraints cannot hold subqueries, so the two array/jsonb shape rules live in immutable helpers.
create function public.meal_types_valid(p_types public.meal_slot[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(p_types) between 1 and 4
    and cardinality(p_types) = (select count(distinct t) from unnest(p_types) as t);
$$;

-- 1-30 items, each { name: text 1-80, grams: number 1-2000 }.
create function public.meal_ingredients_valid(p_items jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_items) is distinct from 'array' then false
    when jsonb_array_length(p_items) not between 1 and 30 then false
    else not exists (
      select 1 from jsonb_array_elements(p_items) as e
      where jsonb_typeof(e) is distinct from 'object'
        or jsonb_typeof(e -> 'name') is distinct from 'string'
        or char_length(e ->> 'name') not between 1 and 80
        or jsonb_typeof(e -> 'grams') is distinct from 'number'
        or (e ->> 'grams')::numeric not between 1 and 2000
    )
  end;
$$;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  meal_types public.meal_slot[] not null check (public.meal_types_valid(meal_types)),
  ingredients jsonb not null check (public.meal_ingredients_valid(ingredients)),
  kcal integer not null check (kcal between 1 and 3000),
  protein_g numeric(6, 1) not null check (protein_g between 0 and 1000),
  carbs_g numeric(6, 1) not null check (carbs_g between 0 and 1000),
  fat_g numeric(6, 1) not null check (fat_g between 0 and 1000),
  fits_vegetarian boolean not null default false,
  fits_vegan boolean not null default false,
  fits_pescatarian boolean not null default false,
  allergens text[] not null default '{}'
    check (allergens <@ array[
      'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
      'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'
    ]::text[]),
  steps text not null default '' check (char_length(steps) <= 10000),
  photo_url text check (
    photo_url is null
    or (
      char_length(photo_url) <= 500
      and (photo_url ~ '^https://\S+$' or photo_url ~ '^/photos/[A-Za-z0-9._/-]+$')
    )
  ),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_published on public.meals (created_at) where published;

create trigger meals_updated_at before update on public.meals
  for each row execute function public.set_updated_at();
create trigger meals_audit after insert or update or delete on public.meals
  for each row execute function public.audit_row('id');

alter table public.meals enable row level security;
create policy meals_select on public.meals for select to authenticated
  using ((select public.is_admin()) or (published and (select public.my_access())));
create policy meals_admin_insert on public.meals for insert to authenticated
  with check ((select public.is_admin()));
create policy meals_admin_update on public.meals for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy meals_admin_delete on public.meals for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.meals from anon, authenticated;
grant select, insert, update, delete on public.meals to authenticated;

-- A member's replacement of one slot of her menu on one day (slot = position in that day's slot list).
create table public.menu_swaps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  menu_date date not null,
  slot smallint not null check (slot between 0 and 4),
  meal_id uuid not null references public.meals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, menu_date, slot)
);
create index menu_swaps_meal on public.menu_swaps (meal_id);

-- Swaps only for today and the two days before it (Europe/Sofia), on insert and when a row is moved.
create function public.menu_swaps_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Sofia')::date;
begin
  if new.menu_date > v_today or new.menu_date < v_today - 2 then
    raise exception 'Смяната е възможна само за днес и предишните два дни.' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.menu_swaps_guard() from public, anon, authenticated;

create trigger menu_swaps_guard before insert or update on public.menu_swaps
  for each row execute function public.menu_swaps_guard();

alter table public.menu_swaps enable row level security;
create policy menu_swaps_select on public.menu_swaps for select to authenticated
  using (user_id = (select auth.uid()));
create policy menu_swaps_insert on public.menu_swaps for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.my_access()));
create policy menu_swaps_update on public.menu_swaps for update to authenticated
  using (user_id = (select auth.uid()) and (select public.my_access()))
  with check (user_id = (select auth.uid()) and (select public.my_access()));
create policy menu_swaps_delete on public.menu_swaps for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.my_access()));

-- The column grant lists every column an upsert writes (PostgREST sets all of them); the policies pin the
-- owner and the trigger pins the date window.
revoke all on public.menu_swaps from anon, authenticated;
grant select, insert, delete on public.menu_swaps to authenticated;
grant update (user_id, menu_date, slot, meal_id) on public.menu_swaps to authenticated;

-- One row per AI meal draft, no text stored. Only claim_meal_draft_call writes it.
create table public.meal_draft_calls (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  called_at timestamptz not null default now()
);
create index meal_draft_calls_called on public.meal_draft_calls (called_at);

alter table public.meal_draft_calls enable row level security;
revoke all on public.meal_draft_calls from anon, authenticated;
revoke all on sequence public.meal_draft_calls_id_seq from anon, authenticated;

-- Takes one of the 200 drafts per Sofia day, shared by all admins. False (and nothing recorded) for a
-- non-admin or once the quota is used up. Serialised so parallel calls cannot overshoot 200.
create function public.claim_meal_draft_call() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_since timestamptz := date_trunc('day', now() at time zone 'Europe/Sofia') at time zone 'Europe/Sofia';
begin
  if v_uid is null or not public.is_admin() then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('meal_draft_calls'));

  if (select count(*) from public.meal_draft_calls c where c.called_at >= v_since) >= 200 then
    return false;
  end if;
  insert into public.meal_draft_calls (admin_id) values (v_uid);
  return true;
end $$;
revoke all on function public.claim_meal_draft_call() from public, anon, authenticated;
grant execute on function public.claim_meal_draft_call() to authenticated;
