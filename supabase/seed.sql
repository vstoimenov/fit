-- Demo content for local work. Video links are placeholders the admin replaces.
insert into public.plans (name, interval, price_cents, sort) values
  ('Месечен', 'month', 1990, 1),
  ('Годишен', 'year', 14900, 2);

with w as (
  insert into public.workouts (title, description, kind, level, duration_min, focus, starter_order, publish_at)
  values
    ('Първа тренировка: цяло тяло', 'Лека тренировка за начало. Без скачане.', 'free', null, 20, '{full_body}', null, now() - interval '30 days'),
    ('Старт 1: Събуди тялото', 'Мобилност и дишане.', 'starter', null, 15, '{stretch}', 1, now() - interval '30 days'),
    ('Старт 2: Стабилен корем', 'Основа за всичко останало.', 'starter', null, 20, '{core}', 2, now() - interval '30 days'),
    ('Старт 3: Дупе и крака', 'Без клекове с тежест.', 'starter', null, 20, '{glutes_legs}', 3, now() - interval '30 days'),
    ('Старт 4: Горна част', 'Ръце, гръб, стойка.', 'starter', null, 20, '{upper}', 4, now() - interval '30 days'),
    ('Старт 5: Цяло тяло', 'Събираме всичко.', 'starter', null, 25, '{full_body}', 5, now() - interval '30 days'),
    ('Корем без болки в кръста', '', 'regular', 'beginner', 25, '{core}', null, now() - interval '4 days'),
    ('Стегнато дупе у дома', '', 'regular', 'beginner', 25, '{glutes_legs}', null, now() - interval '2 days'),
    ('Цяло тяло за 20 минути', '', 'regular', 'beginner', 20, '{full_body}', null, now() + interval '2 days'),
    ('Интервали с ластик', '', 'regular', 'advanced', 30, '{cardio,full_body}', null, now() - interval '3 days'),
    ('Силна горна част', '', 'regular', 'advanced', 30, '{upper}', null, now() + interval '1 day'),
    ('Профи HIIT 40', '', 'regular', 'pro', 40, '{cardio}', null, now() - interval '1 day'),
    ('Профи сила: крака', '', 'regular', 'pro', 40, '{glutes_legs}', null, now() + interval '3 days')
  returning id
)
insert into public.workout_media (workout_id, provider, video_url)
select id, 'youtube', 'https://www.youtube.com/watch?v=ml6cT4AZdqI' from w;
