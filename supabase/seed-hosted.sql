-- Minimal data for a fresh hosted project (run once in the Supabase SQL editor after `db push`).
-- Everything else (workouts with real videos, meals, challenges, articles) is created in /admin.
-- Unlike seed.sql this adds no placeholder videos.

insert into public.plans (name, interval, price_cents, sort)
select v.name, v.interval::public.plan_interval, v.price_cents, v.sort
from (values ('Месечен', 'month', 2900, 1), ('Годишен', 'year', 25700, 2)) as v(name, interval, price_cents, sort)
where not exists (select 1 from public.plans p where p.name = v.name and p.interval = v.interval::public.plan_interval);
