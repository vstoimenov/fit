-- 30 everyday dishes for the daily menu, from I_AM_STRONG_30_yastiya.xlsx (sheet „Ястия“ + „Съставки“).
-- Values are per portion, raw weights, USDA FoodData Central figures as given in the sheet.
-- Allergens are derived from the ingredients; soy sauce in the steps also flags gluten.
-- Safe to re-run: a dish is skipped when a meal with the same title exists.
begin;
insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Овесена каша с гъсто кисело мляко и горски плодове',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Овесени ядки", "grams": 50}, {"name": "Прясно мляко 2%", "grams": 150}, {"name": "Гъсто кисело мляко 2%", "grams": 100}, {"name": "Горски плодове", "grams": 80}, {"name": "Мед", "grams": 10}]'::jsonb,
  408, 22.1, 62.8, 8.4,
  true, false, true, array['gluten', 'milk']::text[],
  5, 5, 1,
  '1. Свари овесените ядки в млякото 5 минути.
2. Разбъркай гъстото кисело мляко, сложи плодовете и меда отгоре.',
  true
where not exists (select 1 from public.meals where title = 'Овесена каша с гъсто кисело мляко и горски плодове');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Омлет със спанак и сирене',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Яйце", "grams": 110, "amount": 2, "unit": "бр."}, {"name": "Яйчен белтък", "grams": 66, "amount": 2, "unit": "бр."}, {"name": "Спанак", "grams": 60}, {"name": "Бяло сирене", "grams": 30}, {"name": "Пълнозърнест хляб", "grams": 40}, {"name": "Зехтин", "grams": 3}]'::jsonb,
  410, 32.3, 21.1, 21.6,
  true, false, true, array['gluten', 'milk', 'eggs']::text[],
  5, 5, 1,
  '1. Разбий 2 яйца и 2 белтъка.
2. Задуши спанака за минута, излей яйцата, натроши сиренето.
3. Сервирай с филия хляб.',
  true
where not exists (select 1 from public.meals where title = 'Омлет със спанак и сирене');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Извара с ябълка, канела и орехи',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Извара 2%", "grams": 200}, {"name": "Ябълка", "grams": 120}, {"name": "Орехи", "grams": 15}, {"name": "Мед", "grams": 5}]'::jsonb,
  338, 23.7, 32.3, 14.6,
  true, false, true, array['milk', 'nuts']::text[],
  5, 0, 1,
  '1. Нарежи ябълката на кубчета, смеси с изварата, поръсни с канела и натрошени орехи, полей с мед.',
  true
where not exists (select 1 from public.meals where title = 'Извара с ябълка, канела и орехи');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Тофу „бъркани яйца“ с домати',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Тофу, твърдо", "grams": 150}, {"name": "Домат", "grams": 100}, {"name": "Лук", "grams": 30}, {"name": "Зехтин", "grams": 5}, {"name": "Пълнозърнест хляб", "grams": 50}]'::jsonb,
  414, 33.7, 31.5, 20.0,
  true, true, true, array['gluten', 'soy']::text[],
  5, 5, 1,
  '1. Натроши тофуто с вилица.
2. Запържи лука, добави тофуто, куркума, сол и нарязания домат за 4–5 минути.
3. С филия хляб.',
  true
where not exists (select 1 from public.meals where title = 'Тофу „бъркани яйца“ с домати');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Сандвич с яйце и авокадо',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Пълнозърнест хляб", "grams": 60}, {"name": "Яйце", "grams": 110, "amount": 2, "unit": "бр."}, {"name": "Авокадо", "grams": 40}, {"name": "Домат", "grams": 50}]'::jsonb,
  378, 22.9, 30.9, 18.5,
  true, false, true, array['gluten', 'eggs']::text[],
  2, 8, 1,
  '1. Свари яйцата за 8 минути.
2. Намачкай авокадото върху препечения хляб, сложи резенчета яйце и домат.',
  true
where not exists (select 1 from public.meals where title = 'Сандвич с яйце и авокадо');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Чиа пудинг със соево мляко и банан',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Чиа", "grams": 25}, {"name": "Соево мляко, неподсладено", "grams": 250}, {"name": "Банан", "grams": 100}, {"name": "Фъстъчено масло", "grams": 10}]'::jsonb,
  352, 15.2, 39.6, 17.0,
  true, true, true, array['soy', 'peanuts']::text[],
  5, 0, 1,
  '1. Вечерта смеси чиата със соевото мляко и остави в хладилника.
2. Сутрин добави нарязан банан и лъжичка фъстъчено масло.',
  true
where not exists (select 1 from public.meals where title = 'Чиа пудинг със соево мляко и банан');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Овесени палачинки с банан',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Овесени ядки", "grams": 40}, {"name": "Яйце", "grams": 55, "amount": 1, "unit": "бр."}, {"name": "Банан", "grams": 60}, {"name": "Гъсто кисело мляко 2%", "grams": 100}]'::jsonb,
  357, 22.8, 45.0, 9.9,
  true, false, true, array['gluten', 'milk', 'eggs']::text[],
  5, 10, 1,
  '1. Пасирай овесените ядки, яйцето и банана.
2. Изпечи 3–4 малки палачинки в незалепващ тиган.
3. Сервирай с гъсто кисело мляко.',
  true
where not exists (select 1 from public.meals where title = 'Овесени палачинки с банан');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Тост с фъстъчено масло и банан',
  array['breakfast']::public.meal_slot[],
  '[{"name": "Пълнозърнест хляб", "grams": 60}, {"name": "Фъстъчено масло", "grams": 15}, {"name": "Банан", "grams": 100}, {"name": "Соево мляко, неподсладено", "grams": 200}]'::jsonb,
  391, 18.7, 54.0, 13.0,
  true, true, true, array['gluten', 'soy', 'peanuts']::text[],
  5, 0, 1,
  '1. Намажи препечения хляб с фъстъчено масло, нареди банан.
2. Изпий чаша соево мляко до него.',
  true
where not exists (select 1 from public.meals where title = 'Тост с фъстъчено масло и банан');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Пилешко филе с киноа и печени зеленчуци',
  array['lunch']::public.meal_slot[],
  '[{"name": "Пилешко филе, сурово", "grams": 150}, {"name": "Киноа, сурова", "grams": 60}, {"name": "Тиквичка", "grams": 100}, {"name": "Чушка", "grams": 80}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  527, 44.2, 46.4, 18.1,
  false, false, false, array[]::text[],
  5, 25, 1,
  '1. Изпечи пилешкото и зеленчуците на 200°C за 25 минути.
2. Свари киноата 15 минути.',
  true
where not exists (select 1 from public.meals where title = 'Пилешко филе с киноа и печени зеленчуци');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Салата с риба тон, боб и яйце',
  array['lunch']::public.meal_slot[],
  '[{"name": "Риба тон в собствен сос, отцедена", "grams": 100}, {"name": "Бял боб, сварен", "grams": 100}, {"name": "Яйце", "grams": 55, "amount": 1, "unit": "бр."}, {"name": "Зелена салата", "grams": 80}, {"name": "Домат", "grams": 100}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  454, 44.1, 31.8, 16.8,
  false, false, true, array['eggs', 'fish']::text[],
  2, 8, 1,
  '1. Смеси салатата, домата, отцедения боб и рибата.
2. Добави сварено яйце, полей със зехтин и лимон.',
  true
where not exists (select 1 from public.meals where title = 'Салата с риба тон, боб и яйце');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Чорба от червена леща',
  array['lunch']::public.meal_slot[],
  '[{"name": "Леща, суха", "grams": 70}, {"name": "Морков", "grams": 60}, {"name": "Лук", "grams": 50}, {"name": "Доматено пасата", "grams": 100}, {"name": "Зехтин", "grams": 10}, {"name": "Пълнозърнест хляб", "grams": 40}]'::jsonb,
  508, 24.9, 77.1, 12.5,
  true, true, true, array['gluten']::text[],
  10, 20, 1,
  '1. Задуши лука и моркова, добави лещата, пасатата и 600 ml вода.
2. Вари 20 минути, пасирай.
3. С филия хляб.',
  true
where not exists (select 1 from public.meals where title = 'Чорба от червена леща');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Пуешко с булгур и салата',
  array['lunch']::public.meal_slot[],
  '[{"name": "Пуешко филе, сурово", "grams": 150}, {"name": "Булгур, сух", "grams": 60}, {"name": "Краставица", "grams": 100}, {"name": "Домат", "grams": 100}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  498, 44.5, 53.0, 13.3,
  false, false, false, array['gluten']::text[],
  10, 15, 1,
  '1. Изпечи пуешкото на скара.
2. Залей булгура с вряла вода и остави 15 минути.
3. Салата от домат и краставица.',
  true
where not exists (select 1 from public.meals where title = 'Пуешко с булгур и салата');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Пълнозърнести макарони болонезе',
  array['lunch']::public.meal_slot[],
  '[{"name": "Пълнозърнести макарони, сухи", "grams": 75}, {"name": "Телешка кайма 10%, сурова", "grams": 100}, {"name": "Доматено пасата", "grams": 150}, {"name": "Лук", "grams": 40}, {"name": "Зехтин", "grams": 5}]'::jsonb,
  545, 32.3, 66.4, 17.2,
  false, false, false, array['gluten']::text[],
  10, 15, 1,
  '1. Запържи каймата с лука, добави пасатата и вари 15 минути.
2. Смеси с варените макарони.',
  true
where not exists (select 1 from public.meals where title = 'Пълнозърнести макарони болонезе');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Боул с нахут, киноа и тахан',
  array['lunch']::public.meal_slot[],
  '[{"name": "Нахут, сварен", "grams": 150}, {"name": "Киноа, сурова", "grams": 50}, {"name": "Авокадо", "grams": 50}, {"name": "Морков", "grams": 60}, {"name": "Зелена салата", "grams": 50}, {"name": "Тахан", "grams": 15}]'::jsonb,
  632, 25.2, 87.9, 22.6,
  true, true, true, array['sesame']::text[],
  5, 15, 1,
  '1. Свари киноата.
2. Нареди в купа нахут, киноа, авокадо, настърган морков и салата.
3. Полей с тахан, разреден с лимон.',
  true
where not exists (select 1 from public.meals where title = 'Боул с нахут, киноа и тахан');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Гръцка салата с пиле',
  array['lunch']::public.meal_slot[],
  '[{"name": "Пилешко филе, сурово", "grams": 120}, {"name": "Домат", "grams": 150}, {"name": "Краставица", "grams": 120}, {"name": "Чушка", "grams": 60}, {"name": "Бяло сирене", "grams": 40}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  399, 35.5, 15.4, 22.2,
  false, false, false, array['milk']::text[],
  5, 15, 1,
  '1. Изпечи пилешкото и го нарежи.
2. Смеси с домат, краставица, чушка и сирене, полей със зехтин.',
  true
where not exists (select 1 from public.meals where title = 'Гръцка салата с пиле');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Пилешко къри със спанак и ориз',
  array['lunch']::public.meal_slot[],
  '[{"name": "Пилешко филе, сурово", "grams": 150}, {"name": "Кафяв ориз, суров", "grams": 60}, {"name": "Лук", "grams": 50}, {"name": "Доматено пасата", "grams": 100}, {"name": "Спанак", "grams": 50}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  552, 41.9, 58.6, 16.1,
  false, false, false, array[]::text[],
  10, 20, 1,
  '1. Запържи лука и пилешкото, добави къри, пасатата и спанака, гответе 15 минути.
2. С варен кафяв ориз.',
  true
where not exists (select 1 from public.meals where title = 'Пилешко къри със спанак и ориз');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Тофу с броколи и кафяв ориз',
  array['lunch']::public.meal_slot[],
  '[{"name": "Тофу, твърдо", "grams": 150}, {"name": "Кафяв ориз, суров", "grams": 60}, {"name": "Броколи", "grams": 120}, {"name": "Чушка", "grams": 80}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  588, 34.8, 63.2, 25.5,
  true, true, true, array['gluten', 'soy']::text[],
  10, 15, 1,
  '1. Запечи тофуто на кубчета в тиган.
2. Добави броколи и чушка, соев сос и чесън, 5 минути.
3. С варен ориз.',
  true
where not exists (select 1 from public.meals where title = 'Тофу с броколи и кафяв ориз');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Тортила с черен боб и царевица',
  array['lunch']::public.meal_slot[],
  '[{"name": "Пълнозърнеста тортила", "grams": 60}, {"name": "Черен боб, сварен", "grams": 120}, {"name": "Царевица, консерва", "grams": 50}, {"name": "Домат", "grams": 80}, {"name": "Авокадо", "grams": 40}]'::jsonb,
  456, 19.2, 72.8, 11.7,
  true, true, true, array['gluten']::text[],
  5, 5, 1,
  '1. Затопли боба с кимион.
2. Напълни тортилата с боб, царевица, домат и авокадо, сгъни.',
  true
where not exists (select 1 from public.meals where title = 'Тортила с черен боб и царевица');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Сьомга с картофи и броколи',
  array['lunch']::public.meal_slot[],
  '[{"name": "Сьомга, сурова", "grams": 130}, {"name": "Картофи", "grams": 200}, {"name": "Броколи", "grams": 150}, {"name": "Зехтин", "grams": 5}]'::jsonb,
  520, 34.7, 44.9, 23.2,
  false, false, true, array['fish']::text[],
  5, 25, 1,
  '1. Изпечи сьомгата и картофите на 200°C.
2. Свари броколите на пара 5 минути.',
  true
where not exists (select 1 from public.meals where title = 'Сьомга с картофи и броколи');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Шопска салата с извара и яйце',
  array['lunch']::public.meal_slot[],
  '[{"name": "Домат", "grams": 150}, {"name": "Краставица", "grams": 150}, {"name": "Чушка", "grams": 60}, {"name": "Лук", "grams": 20}, {"name": "Извара 2%", "grams": 150}, {"name": "Яйце", "grams": 55, "amount": 1, "unit": "бр."}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  362, 25.9, 24.3, 19.3,
  true, false, true, array['milk', 'eggs']::text[],
  5, 5, 1,
  '1. Нарежи зеленчуците, добави изварата вместо сирене и сварено яйце, полей със зехтин.',
  true
where not exists (select 1 from public.meals where title = 'Шопска салата с извара и яйце');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Хек на фурна със зеленчуци и картофи',
  array['dinner']::public.meal_slot[],
  '[{"name": "Хек, суров", "grams": 180}, {"name": "Тиквичка", "grams": 150}, {"name": "Чушка", "grams": 80}, {"name": "Лук", "grams": 40}, {"name": "Картофи", "grams": 150}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  425, 38.4, 39.4, 13.6,
  false, false, true, array['fish']::text[],
  10, 25, 1,
  '1. Нареди картофите, зеленчуците и рибата в тава, полей със зехтин и лимон.
2. Печи 25–30 минути на 200°C.',
  true
where not exists (select 1 from public.meals where title = 'Хек на фурна със зеленчуци и картофи');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Пилешка супа с ориз и зеленчуци',
  array['dinner']::public.meal_slot[],
  '[{"name": "Пилешко филе, сурово", "grams": 120}, {"name": "Бял ориз, суров", "grams": 30}, {"name": "Морков", "grams": 60}, {"name": "Картофи", "grams": 100}, {"name": "Лук", "grams": 30}]'::jsonb,
  366, 31.8, 49.8, 3.6,
  false, false, false, array[]::text[],
  10, 25, 1,
  '1. Свари пилешкото с моркова, лука и картофа в 600 ml вода.
2. Добави ориза последните 15 минути.',
  true
where not exists (select 1 from public.meals where title = 'Пилешка супа с ориз и зеленчуци');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Яхния от бял боб',
  array['dinner']::public.meal_slot[],
  '[{"name": "Бял боб, сварен", "grams": 200}, {"name": "Лук", "grams": 50}, {"name": "Морков", "grams": 50}, {"name": "Доматено пасата", "grams": 100}, {"name": "Зехтин", "grams": 10}, {"name": "Пълнозърнест хляб", "grams": 40}]'::jsonb,
  536, 27.0, 82.0, 12.5,
  true, true, true, array['gluten']::text[],
  10, 20, 1,
  '1. Задуши лука и моркова, добави боба, пасатата, чубрица и вода.
2. Вари 20 минути.
3. С филия хляб.',
  true
where not exists (select 1 from public.meals where title = 'Яхния от бял боб');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Скариди с тиквички и макарони',
  array['dinner']::public.meal_slot[],
  '[{"name": "Скариди, сурови", "grams": 150}, {"name": "Пълнозърнести макарони, сухи", "grams": 60}, {"name": "Тиквичка", "grams": 150}, {"name": "Домат", "grams": 100}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  471, 40.6, 53.1, 12.9,
  false, false, true, array['gluten', 'crustaceans']::text[],
  5, 15, 1,
  '1. Запържи скаридите с чесън 3 минути, добави тиквичките и доматите.
2. Смеси с варените макарони.',
  true
where not exists (select 1 from public.meals where title = 'Скариди с тиквички и макарони');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Пълнени чушки с ориз и леща',
  array['dinner']::public.meal_slot[],
  '[{"name": "Чушка", "grams": 250}, {"name": "Кафяв ориз, суров", "grams": 30}, {"name": "Леща, суха", "grams": 50}, {"name": "Лук", "grams": 40}, {"name": "Доматено пасата", "grams": 100}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  486, 19.0, 79.4, 12.4,
  true, true, true, array[]::text[],
  15, 35, 1,
  '1. Свари лещата и ориза наполовина, смеси със задушен лук.
2. Напълни чушките, залей с пасата и печи 35 минути.',
  true
where not exists (select 1 from public.meals where title = 'Пълнени чушки с ориз и леща');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Фритата с картофи и зеленчуци',
  array['dinner']::public.meal_slot[],
  '[{"name": "Яйце", "grams": 165, "amount": 3, "unit": "бр."}, {"name": "Картофи", "grams": 150}, {"name": "Чушка", "grams": 60}, {"name": "Лук", "grams": 30}, {"name": "Бяло сирене", "grams": 30}, {"name": "Зехтин", "grams": 5}]'::jsonb,
  502, 29.0, 35.0, 27.4,
  true, false, true, array['milk', 'eggs']::text[],
  10, 15, 1,
  '1. Свари картофите, нарежи ги.
2. Разбий яйцата със сиренето, излей върху картофите и зеленчуците и запечи 10 минути.',
  true
where not exists (select 1 from public.meals where title = 'Фритата с картофи и зеленчуци');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Пуешки кюфтета в доматен сос',
  array['dinner']::public.meal_slot[],
  '[{"name": "Пуешка кайма, сурова", "grams": 150}, {"name": "Доматено пасата", "grams": 150}, {"name": "Лук", "grams": 30}, {"name": "Пълнозърнест хляб", "grams": 30}, {"name": "Зелена салата", "grams": 100}, {"name": "Зехтин", "grams": 5}]'::jsonb,
  417, 37.3, 26.9, 19.0,
  false, false, false, array['gluten']::text[],
  10, 20, 1,
  '1. Смеси каймата с настъргания лук и накиснатия хляб, оформи кюфтета.
2. Задуши ги в пасатата 20 минути.
3. Със салата.',
  true
where not exists (select 1 from public.meals where title = 'Пуешки кюфтета в доматен сос');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Темпе с киноа и спанак',
  array['dinner']::public.meal_slot[],
  '[{"name": "Темпе", "grams": 120}, {"name": "Киноа, сурова", "grams": 50}, {"name": "Спанак", "grams": 100}, {"name": "Лук", "grams": 30}, {"name": "Зехтин", "grams": 10}]'::jsonb,
  538, 34.6, 47.6, 26.4,
  true, true, true, array['gluten', 'soy']::text[],
  10, 15, 1,
  '1. Свари киноата.
2. Запечи темпето на резени, задуши спанака с лука.
3. Подправи със соев сос и лимон.',
  true
where not exists (select 1 from public.meals where title = 'Темпе с киноа и спанак');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Гъсто кисело мляко с бадеми',
  array['snack']::public.meal_slot[],
  '[{"name": "Гъсто кисело мляко 2%", "grams": 200}, {"name": "Бадеми", "grams": 15}]'::jsonb,
  233, 23.0, 11.0, 11.3,
  true, false, true, array['milk', 'nuts']::text[],
  2, 0, 1,
  '1. Сложи бадемите върху киселото мляко.
2. Може и щипка канела.',
  true
where not exists (select 1 from public.meals where title = 'Гъсто кисело мляко с бадеми');

insert into public.meals (
  title, meal_types, ingredients, kcal, protein_g, carbs_g, fat_g,
  fits_vegetarian, fits_vegan, fits_pescatarian, allergens,
  prep_min, cook_min, servings, steps, published
)
select
  'Хумус с моркови и краставица',
  array['snack']::public.meal_slot[],
  '[{"name": "Хумус", "grams": 70}, {"name": "Морков", "grams": 100}, {"name": "Краставица", "grams": 100}]'::jsonb,
  172, 7.1, 23.2, 7.0,
  true, true, true, array['sesame']::text[],
  5, 0, 1,
  '1. Нарежи зеленчуците на пръчици и ги потапяй в хумуса.',
  true
where not exists (select 1 from public.meals where title = 'Хумус с моркови и краставица');
commit;

select t as meal_type, count(*) as dishes from public.meals, unnest(meal_types) t
where published group by t order by t;
