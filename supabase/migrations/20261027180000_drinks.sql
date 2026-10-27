-- Drinks as their own diary group („Напитки“), so liquid calories are visible on their own, and a
-- quick list of common drinks in the add sheet (source 'preset'). Drinks are a diary group only: the
-- owner's menu meals keep the four meal types (the check compares as text, because a new enum value
-- cannot be used as an enum in the transaction that adds it).
alter type public.meal_slot add value if not exists 'drinks';
alter type public.food_source add value if not exists 'preset';

create or replace function public.meal_types_valid(p_types public.meal_slot[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(p_types) between 1 and 4
    and cardinality(p_types) = (select count(distinct t) from unnest(p_types) as t)
    and not ('drinks' = any (p_types::text[]));
$$;
