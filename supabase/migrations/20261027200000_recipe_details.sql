-- Recipe pages: a short description, preparation and cooking time, how many portions the ingredient
-- list makes (kcal and macros stay per portion, so the menu is unaffected), and an optional household
-- measure per ingredient („1½ ч.л.“, „50 мл“) next to the grams the nutrition is computed from.
alter table public.meals
  add column description text not null default '' check (char_length(description) <= 2000),
  add column prep_min smallint check (prep_min between 0 and 600),
  add column cook_min smallint check (cook_min between 0 and 600),
  add column servings smallint not null default 1 check (servings between 1 and 24);

-- 1-30 items, each { name: text 1-80, grams: number 1-2000 } plus an optional amount (0-5000) with
-- one of the known units.
create or replace function public.meal_ingredients_valid(p_items jsonb) returns boolean
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
        or (e ? 'amount' and (
              jsonb_typeof(e -> 'amount') is distinct from 'number'
              or (e ->> 'amount')::numeric <= 0
              or (e ->> 'amount')::numeric > 5000))
        or (e ? 'unit' and (e ->> 'unit') not in ('г', 'мл', 'ч.л.', 'с.л.', 'ч.ч.', 'бр.', 'щипка'))
        or (e ? 'unit') <> (e ? 'amount')
    )
  end;
$$;
