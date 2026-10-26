-- Public (anonymous) reads for the marketing site. Both functions are the only way a
-- signed-out visitor sees these rows; the tables themselves stay closed to anon.

-- Two optional links the owner sets in /admin/settings.
insert into public.settings (key, value)
values ('trainer_video_url', '""'::jsonb), ('instagram_url', '""'::jsonb)
on conflict (key) do nothing;

-- {"trainer_video_url": text|null, "instagram_url": text|null}; only https values pass.
create function public.public_site_links() returns jsonb
language sql stable security definer set search_path = '' as $$
  with links as (
    select key,
           case when nullif(btrim(value #>> '{}'), '') like 'https://%'
                then btrim(value #>> '{}') end as v
    from public.settings
    where key in ('trainer_video_url', 'instagram_url') and jsonb_typeof(value) = 'string'
  )
  select jsonb_build_object(
    'trainer_video_url', (select v from links where key = 'trainer_video_url'),
    'instagram_url', (select v from links where key = 'instagram_url')
  );
$$;
revoke execute on function public.public_site_links() from public;
grant execute on function public.public_site_links() to anon, authenticated;

-- The single published free workout (kind = 'free') with its video, for the „try it now" section.
-- Same publish rule as can_watch(); a free workout cannot carry min_member_level (table check).
create function public.public_free_workout()
returns table (id uuid, title text, duration_min int, thumbnail_url text, video_url text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.title, w.duration_min, w.thumbnail_url, m.video_url
  from public.workouts w
  join public.workout_media m on m.workout_id = w.id
  where w.kind = 'free'
    and w.publish_at is not null and w.publish_at <= now()
  order by w.created_at
  limit 1;
$$;
revoke execute on function public.public_free_workout() from public;
grant execute on function public.public_free_workout() to anon, authenticated;
