-- Овесени бисквитки с банан и шоколад (10 броя). Our own wording; the owner adds her own photo in /admin/meals.
-- Nutrition per cookie is our estimate from standard food tables (whole batch ≈ 1000 kcal).
-- Run once on the hosted project:
--   pnpm exec supabase db query --linked --file supabase/seed-recipes/2026-10-27-oat-cookies.sql
insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  description, prep_min, cook_min, servings, steps, published
)
select
  'Овесени бисквитки с банан и шоколад',
  array['breakfast', 'snack']::public.meal_slot[],
  '[
    {"name": "Банани", "grams": 160},
    {"name": "Кокосово масло", "grams": 15},
    {"name": "Овесени ядки", "grams": 100},
    {"name": "Кокосови стърготини", "grams": 30},
    {"name": "Канела (цейлонска)", "grams": 3, "amount": 1, "unit": "ч.л."},
    {"name": "Сол", "grams": 3, "amount": 0.5, "unit": "ч.л."},
    {"name": "Шоколадови парченца", "grams": 25}
  ]'::jsonb,
  99, 1.9, 11.9, 5.1,
  true, true, true, array['gluten'],
  'Хрупкави отвън и меки отвътре, а единствената сладост идва от узрелите банани. Запечените в тиган овесени ядки и кокос им дават аромат на печени сладки. Ако ги искаш по-сладки, добави лъжица кленов сироп. Най-вкусни са в първия ден.',
  15, 25, 10,
  '1. Сложи бананите целите, с кората, във фурната на 160°C за около 10 минути. Така узряват, потъмняват и стават по-сладки.
2. В тиган на средно до силен огън запечи овесените ядки, кокосовите стърготини, кокосовото масло, канелата и солта. Бъркай постоянно, за да не загорят — така бисквитките стават по-ароматни и хрупкави.
3. Обели бананите и ги намачкай с вилица. Не изключвай фурната, ще ти трябва отново на 160°C.
4. Смеси запечената овесено-кокосова смес с бананите. Добави шоколадовите парченца, като оставиш малко за отгоре.
5. С влажни ръце оформи 10 бисквитки и ги нареди върху хартия за печене. Натисни отгоре останалите шоколадови парченца.
6. Печи на 160°C за 20–30 минути, докато ръбовете станат златисти. На втория ден ги затопли за 5 минути във фурната и пак са като пресни.',
  true
where not exists (select 1 from public.meals where title = 'Овесени бисквитки с банан и шоколад')
returning id, title;
