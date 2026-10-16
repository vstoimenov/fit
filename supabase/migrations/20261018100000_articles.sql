-- Owner-authored articles ("Полезно" tab). Members read published ones through RLS; only admins write.
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 1 and 120),
  excerpt text not null default '' check (char_length(excerpt) <= 300),
  body text not null default '' check (char_length(body) <= 50000),
  cover_url text check (cover_url is null or (char_length(cover_url) <= 500 and cover_url ~ '^(https://|/photos/)')),
  level public.workout_level,
  members_only boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_published on public.articles (published_at desc) where published_at is not null;

create trigger articles_updated_at before update on public.articles
  for each row execute function public.set_updated_at();
create trigger articles_audit after insert or update or delete on public.articles
  for each row execute function public.audit_row('id');

alter table public.articles enable row level security;

create policy articles_select on public.articles for select to authenticated
  using (
    (select public.is_admin())
    or (
      published_at is not null and published_at <= now()
      and (not members_only or (select public.my_access()))
    )
  );
create policy articles_admin_insert on public.articles for insert to authenticated
  with check ((select public.is_admin()));
create policy articles_admin_update on public.articles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy articles_admin_delete on public.articles for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.articles from anon;
revoke insert, update, delete on public.articles from authenticated;
grant select, insert, update, delete on public.articles to authenticated;

-- Community link for members. Settings are admin-only, so clients read just this one value, and only
-- when it is a plain https URL (anything else behaves as "no community yet").
create function public.community_link() returns text
language sql stable security definer set search_path = '' as $$
  select case when v like 'https://%' then v end
  from (
    select nullif(btrim(value #>> '{}'), '') as v
    from public.settings
    where key = 'community_url' and jsonb_typeof(value) = 'string'
  ) s;
$$;
revoke execute on function public.community_link() from public, anon;
grant execute on function public.community_link() to authenticated;
