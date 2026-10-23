-- Progress photos. A private bucket: only the owner reads, uploads or removes her own objects (no admin
-- policy, nothing for anon). The table is written only through security-definer functions that check the
-- path, the stored object, the date and the per-member cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Objects live at {user_id}/{uuid}.jpg. No update policy: a photo is replaced by uploading a new one.
create policy progress_photos_own_select on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Inserts must match the exact {user_id}/{uuid}.jpg shape (no nested folders: account deletion lists only
-- the top level of her folder), the same pattern add_progress_photo checks.
create policy progress_photos_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  );
create policy progress_photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  path text not null unique,
  taken_on date not null,
  created_at timestamptz not null default now()
);
create index progress_photos_user_taken on public.progress_photos (user_id, taken_on desc, created_at desc);

alter table public.progress_photos enable row level security;
create policy progress_photos_select on public.progress_photos for select to authenticated
  using (user_id = (select auth.uid()));
-- No insert/update/delete policies or grants: rows are written only by the functions below.
revoke all on public.progress_photos from anon, authenticated;
grant select on public.progress_photos to authenticated;

-- Records a photo she has already uploaded. Idempotent per path. Serialised per member so concurrent
-- calls cannot slip past the 200-photo cap or race on the unique path.
create function public.add_progress_photo(p_path text, p_taken_on date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_path is null or p_taken_on is null
     or p_path !~ ('^' || v_uid::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$') then
    raise exception 'invalid photo path' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('progress_photos:' || v_uid::text));

  select id into v_id from public.progress_photos where path = p_path and user_id = v_uid;
  if found then
    return v_id;
  end if;

  if not exists (select 1 from storage.objects where bucket_id = 'progress-photos' and name = p_path) then
    raise exception 'photo not uploaded' using errcode = 'P0002';
  end if;
  if p_taken_on < date '2000-01-01' or p_taken_on > (now() at time zone 'Europe/Sofia')::date then
    raise exception 'invalid photo date' using errcode = '22023';
  end if;
  if (select count(*) from public.progress_photos where user_id = v_uid) >= 200 then
    raise exception 'Можеш да пазиш до 200 снимки. Изтрий някоя стара, за да добавиш нова.'
      using errcode = 'P0001';
  end if;

  insert into public.progress_photos (user_id, path, taken_on)
  values (v_uid, p_path, p_taken_on)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.add_progress_photo(text, date) from public, anon, authenticated;
grant execute on function public.add_progress_photo(text, date) to authenticated;

-- Removes her own row (the caller deletes the stored object first). Another member's id is a no-op.
create function public.delete_progress_photo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.progress_photos where id = p_id and user_id = v_uid;
end $$;
revoke all on function public.delete_progress_photo(uuid) from public, anon, authenticated;
grant execute on function public.delete_progress_photo(uuid) to authenticated;
