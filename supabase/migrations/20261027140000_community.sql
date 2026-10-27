-- Phase 4: community. Members with access post (text + one photo), comment, heart and report; the
-- owner hides or deletes. Every read and write goes through security-definer functions: the tables
-- carry no grants for API roles, and names come out as "first name + initial" only.

-- Photos: private bucket, own-folder upload, read only with access (signed URLs server-side).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-photos', 'community-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
create policy community_photos_member_select on storage.objects for select to authenticated
  using (bucket_id = 'community-photos' and (select public.my_access()));
create policy community_photos_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-photos'
    and (select public.my_access())
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  );
create policy community_photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  photo_path text check (photo_path is null or char_length(photo_path) <= 200),
  completion_id uuid references public.workout_completions (id) on delete set null,
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index community_posts_created on public.community_posts (created_at desc);
create index community_posts_user on public.community_posts (user_id, created_at desc);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index community_comments_post on public.community_comments (post_id, created_at);
create index community_comments_user on public.community_comments (user_id, created_at desc);

create table public.community_hearts (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);
create index community_reports_open on public.community_reports (created_at desc) where resolved_at is null;

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_hearts enable row level security;
alter table public.community_reports enable row level security;
revoke all on public.community_posts, public.community_comments, public.community_hearts,
  public.community_reports from anon, authenticated;

-- Points: post 3, comment 1, combined community cap 5 per Sofia day (partial award up to the cap).
create function public.award_community_points(p_user_id uuid, p_source public.points_source, p_ref text, p_points int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today text := to_char(now() at time zone 'Europe/Sofia', 'YYYY-MM-DD');
  v_used int;
  v_grant int;
begin
  select coalesce(sum(points), 0) into v_used
    from public.points_ledger
    where user_id = p_user_id and source in ('post', 'comment')
      and to_char(created_at at time zone 'Europe/Sofia', 'YYYY-MM-DD') = v_today;
  v_grant := least(p_points, 5 - v_used);
  if v_grant <= 0 then
    return;
  end if;
  insert into public.points_ledger (user_id, source, ref, points)
  values (p_user_id, p_source, p_ref, v_grant)
  on conflict (user_id, source, ref) do nothing;
end $$;
revoke all on function public.award_community_points(uuid, public.points_source, text, int) from public, anon, authenticated;

-- "Мария Петрова" → "Мария П."; a single word stays as is.
create function public.community_display_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select case
    when btrim(coalesce(p_name, '')) = '' then 'Членка'
    when array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) >= 2
      then (regexp_split_to_array(btrim(p_name), '\s+'))[1] || ' ' ||
           left((regexp_split_to_array(btrim(p_name), '\s+'))[2], 1) || '.'
    else btrim(p_name)
  end;
$$;
revoke all on function public.community_display_name(text) from public, anon, authenticated;

create function public.create_post(p_body text, p_photo_path text, p_completion_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
  v_completion uuid := nullif(btrim(coalesce(p_completion_id, '')), '')::uuid;
  v_id uuid;
begin
  if v_uid is null or not public.my_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then
    raise exception 'body must be 1..1000 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.community_posts p
      where p.user_id = v_uid and p.created_at > now() - interval '1 day') >= 5 then
    raise exception 'До 5 публикации на ден. Опитай утре.' using errcode = 'P0001';
  end if;
  if v_photo is not null then
    if v_photo !~ ('^' || v_uid::text || '/[0-9a-f-]{36}\.jpg$')
       or not exists (select 1 from storage.objects where bucket_id = 'community-photos' and name = v_photo) then
      raise exception 'photo not uploaded' using errcode = 'P0002';
    end if;
  end if;
  if v_completion is not null and not exists (
    select 1 from public.workout_completions c where c.id = v_completion and c.user_id = v_uid
  ) then
    v_completion := null;
  end if;
  insert into public.community_posts (user_id, body, photo_path, completion_id)
  values (v_uid, v_body, v_photo, v_completion)
  returning id into v_id;
  perform public.award_community_points(v_uid, 'post', v_id::text, 3);
  return v_id;
end $$;

create function public.create_comment(p_post_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_uid is null or not public.my_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'body must be 1..500 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.community_posts p where p.id = p_post_id and p.hidden_at is null) then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.community_comments c
      where c.user_id = v_uid and c.created_at > now() - interval '1 day') >= 30 then
    raise exception 'До 30 коментара на ден.' using errcode = 'P0001';
  end if;
  insert into public.community_comments (post_id, user_id, body)
  values (p_post_id, v_uid, v_body)
  returning id into v_id;
  perform public.award_community_points(v_uid, 'comment', v_id::text, 1);
  return v_id;
end $$;

-- Returns the new state (true = hearted).
create function public.toggle_heart(p_post_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.my_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_posts p where p.id = p_post_id and p.hidden_at is null) then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  delete from public.community_hearts where post_id = p_post_id and user_id = v_uid;
  if found then
    return false;
  end if;
  insert into public.community_hearts (post_id, user_id) values (p_post_id, v_uid);
  return true;
end $$;

create function public.report_content(p_post_id text, p_comment_id text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_post uuid := nullif(btrim(coalesce(p_post_id, '')), '')::uuid;
  v_comment uuid := nullif(btrim(coalesce(p_comment_id, '')), '')::uuid;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if v_uid is null or not public.my_access() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (v_post is null) = (v_comment is null) then
    raise exception 'report one thing' using errcode = '22023';
  end if;
  if v_reason = '' then
    v_reason := 'Без причина';
  end if;
  if exists (select 1 from public.community_reports r
             where r.user_id = v_uid and r.resolved_at is null
               and r.post_id is not distinct from v_post and r.comment_id is not distinct from v_comment) then
    return;
  end if;
  insert into public.community_reports (post_id, comment_id, user_id, reason)
  values (v_post, v_comment, v_uid, v_reason);
end $$;

create function public.delete_own_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.community_posts where id = p_id and user_id = (select auth.uid());
  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
end $$;

create function public.delete_own_comment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.community_comments where id = p_id and user_id = (select auth.uid());
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
end $$;

-- Feed page: newest first, before a cursor; hidden posts show only to their author (marked).
create function public.community_feed(p_before text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_before timestamptz := nullif(btrim(coalesce(p_before, '')), '')::timestamptz;
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_out jsonb;
begin
  if v_uid is null or not (public.my_access() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(row_to_json(f)::jsonb order by f.created_at desc), '[]'::jsonb) into v_out
  from (
    select p.id, p.body, p.photo_path, p.completion_id, p.created_at,
           p.hidden_at is not null as hidden,
           p.user_id = v_uid as mine,
           public.community_display_name(pr.name) as author_name,
           (select count(*) from public.community_hearts h where h.post_id = p.id)::int as hearts,
           (select count(*) from public.community_comments c where c.post_id = p.id and c.hidden_at is null)::int as comments,
           exists (select 1 from public.community_hearts h where h.post_id = p.id and h.user_id = v_uid) as hearted_by_me
    from public.community_posts p
    join public.profiles pr on pr.id = p.user_id
    where (p.hidden_at is null or p.user_id = v_uid or public.is_admin())
      and (v_before is null or p.created_at < v_before)
    order by p.created_at desc
    limit v_limit
  ) f;
  return v_out;
end $$;

create function public.community_post(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_out jsonb;
begin
  if v_uid is null or not (public.my_access() or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
      'id', p.id, 'body', p.body, 'photo_path', p.photo_path, 'completion_id', p.completion_id,
      'created_at', p.created_at, 'hidden', p.hidden_at is not null,
      'mine', p.user_id = v_uid,
      'author_name', public.community_display_name(pr.name),
      'hearts', (select count(*) from public.community_hearts h where h.post_id = p.id),
      'hearted_by_me', exists (select 1 from public.community_hearts h where h.post_id = p.id and h.user_id = v_uid),
      'comments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'body', c.body, 'created_at', c.created_at,
          'mine', c.user_id = v_uid,
          'author_name', public.community_display_name(cp.name)
        ) order by c.created_at)
        from public.community_comments c join public.profiles cp on cp.id = c.user_id
        where c.post_id = p.id and (c.hidden_at is null or public.is_admin())
      ), '[]'::jsonb)
    ) into v_out
  from public.community_posts p join public.profiles pr on pr.id = p.user_id
  where p.id = p_id and (p.hidden_at is null or p.user_id = v_uid or public.is_admin());
  return v_out;
end $$;

-- Owner: hide/unhide (reversible) and the open reports with context.
create function public.admin_moderate_post(p_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.community_posts
    set hidden_at = case when p_hidden then now() else null end,
        hidden_by = case when p_hidden then (select auth.uid()) else null end
    where id = p_id;
  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if p_hidden then
    update public.community_reports set resolved_at = now() where post_id = p_id and resolved_at is null;
  end if;
end $$;

create function public.admin_moderate_comment(p_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.community_comments
    set hidden_at = case when p_hidden then now() else null end,
        hidden_by = case when p_hidden then (select auth.uid()) else null end
    where id = p_id;
  if not found then
    raise exception 'comment not found' using errcode = 'P0002';
  end if;
  if p_hidden then
    update public.community_reports set resolved_at = now() where comment_id = p_id and resolved_at is null;
  end if;
end $$;

create function public.admin_delete_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.community_posts where id = p_id;
end $$;

create function public.admin_dismiss_report(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.community_reports set resolved_at = now() where id = p_id;
end $$;

create function public.community_reports() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when (select public.is_admin()) then coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'post_id', r.post_id, 'comment_id', r.comment_id, 'reason', r.reason, 'created_at', r.created_at,
      'reporter', public.community_display_name(rp.name),
      'body', coalesce(p.body, c.body),
      'author', public.community_display_name(coalesce(pp.name, cp.name)),
      'hidden', coalesce(p.hidden_at, c.hidden_at) is not null,
      'context_post_id', coalesce(p.id, c.post_id)
    ) order by r.created_at desc)
    from public.community_reports r
    join public.profiles rp on rp.id = r.user_id
    left join public.community_posts p on p.id = r.post_id
    left join public.profiles pp on pp.id = p.user_id
    left join public.community_comments c on c.id = r.comment_id
    left join public.profiles cp on cp.id = c.user_id
    where r.resolved_at is null
  ), '[]'::jsonb) else null end;
$$;

revoke execute on function public.create_post(text, text, text) from public, anon;
revoke execute on function public.create_comment(uuid, text) from public, anon;
revoke execute on function public.toggle_heart(uuid) from public, anon;
revoke execute on function public.report_content(text, text, text) from public, anon;
revoke execute on function public.delete_own_post(uuid) from public, anon;
revoke execute on function public.delete_own_comment(uuid) from public, anon;
revoke execute on function public.community_feed(text, int) from public, anon;
revoke execute on function public.community_post(uuid) from public, anon;
revoke execute on function public.admin_moderate_post(uuid, boolean) from public, anon;
revoke execute on function public.admin_moderate_comment(uuid, boolean) from public, anon;
revoke execute on function public.admin_delete_post(uuid) from public, anon;
revoke execute on function public.admin_dismiss_report(uuid) from public, anon;
revoke execute on function public.community_reports() from public, anon;
grant execute on function public.create_post(text, text, text), public.create_comment(uuid, text),
  public.toggle_heart(uuid), public.report_content(text, text, text), public.delete_own_post(uuid),
  public.delete_own_comment(uuid), public.community_feed(text, int), public.community_post(uuid),
  public.admin_moderate_post(uuid, boolean), public.admin_moderate_comment(uuid, boolean),
  public.admin_delete_post(uuid), public.admin_dismiss_report(uuid), public.community_reports()
  to authenticated;

-- Photos of a deleted account go with it (the row cascade handles the tables).
create trigger community_posts_audit after update or delete on public.community_posts
  for each row execute function public.audit_row('id');
