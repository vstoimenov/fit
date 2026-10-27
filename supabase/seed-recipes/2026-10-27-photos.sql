-- Stock photos (Unsplash License, see public/photos/CREDITS.md) for the two recipes and the two
-- nutrition articles added on 2026-10-27. Safe to re-run. Run after the recipe and article seeds.

update public.meals set photo_url = '/photos/recipe-banana-bread.jpg'
where title = 'Веган бананов кекс с фурми';

update public.meals set photo_url = '/photos/recipe-oat-cookies.jpg'
where title = 'Овесени бисквитки с банан и шоколад';

update public.articles set cover_url = '/photos/article-habits.jpg'
where slug = 'hranene-bez-ponedelnitsi';

update public.articles set cover_url = '/photos/article-protein.jpg'
where slug = 'kolko-protein-ti-tryabva';

select 'meal' as kind, title as name, photo_url as photo from public.meals
where title in ('Веган бананов кекс с фурми', 'Овесени бисквитки с банан и шоколад')
union all
select 'article', slug, cover_url from public.articles
where slug in ('hranene-bez-ponedelnitsi', 'kolko-protein-ti-tryabva');
