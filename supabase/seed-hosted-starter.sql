-- Hosted bootstrap: the free workout and the five starter-week workouts, which onboarding and
-- the first week of the app need. The video is a PLACEHOLDER — replace every link in
-- /admin/workouts with the real videos before inviting anyone. Safe to re-run (inserts only when
-- there is no free workout yet).
with existing as (select 1 from public.workouts where kind = 'free'),
w as (
  insert into public.workouts (title, description, kind, level, duration_min, focus, starter_order, publish_at)
  select * from (values
    ('Първа тренировка: цяло тяло', 'Лека тренировка за начало. Без скачане.', 'free'::public.workout_kind, null::public.workout_level, 20, '{full_body}'::text[], null::smallint, now() - interval '1 day'),
    ('Старт 1: Събуди тялото', 'Мобилност и дишане.', 'starter', null, 15, '{stretch}', 1, now() - interval '1 day'),
    ('Старт 2: Стабилен корем', 'Основа за всичко останало.', 'starter', null, 20, '{core}', 2, now() - interval '1 day'),
    ('Старт 3: Дупе и крака', 'Без клекове с тежест.', 'starter', null, 20, '{glutes_legs}', 3, now() - interval '1 day'),
    ('Старт 4: Горна част', 'Ръце, гръб, стойка.', 'starter', null, 20, '{upper}', 4, now() - interval '1 day'),
    ('Старт 5: Цяло тяло', 'Събираме всичко.', 'starter', null, 25, '{full_body}', 5, now() - interval '1 day')
  ) as v(title, description, kind, level, duration_min, focus, starter_order, publish_at)
  where not exists (select 1 from existing)
  returning id
)
insert into public.workout_media (workout_id, provider, video_url)
select id, 'youtube', 'https://www.youtube.com/watch?v=ml6cT4AZdqI' from w;
