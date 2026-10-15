create type public.note_kind as enum ('call', 'message', 'note', 'snooze');

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind public.note_kind not null,
  body text not null default '' check (char_length(body) <= 2000),
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  constraint client_notes_snooze check ((kind = 'snooze') = (snooze_until is not null))
);
create index client_notes_user_created on public.client_notes (user_id, created_at desc);

-- No foreign keys: the log must outlive the rows and people it mentions.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created on public.audit_log (created_at desc);
create index audit_log_target on public.audit_log (target_id);

create table public.settings (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- Row-level audit. tg_argv[0] names the column that identifies the row.
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k))
      into v_diff
      from jsonb_object_keys(v_new) as k
      where k <> 'updated_at' and (v_new -> k) is distinct from (v_old -> k);
    if v_diff is null then
      return new;
    end if;
  else
    v_diff := coalesce(v_new, v_old);
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, diff)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_new, v_old) ->> tg_argv[0],
    v_diff
  );
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;

create trigger workouts_audit after insert or update or delete on public.workouts
  for each row execute function public.audit_row('id');
create trigger workout_media_audit after insert or update or delete on public.workout_media
  for each row execute function public.audit_row('workout_id');
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function public.audit_row('id');
create trigger subscriptions_audit after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row('user_id');
create trigger settings_audit after insert or update or delete on public.settings
  for each row execute function public.audit_row('key');
create trigger profiles_role_audit after update of role on public.profiles
  for each row execute function public.audit_row('id');

-- Starter week order in one transaction (the partial unique index forbids pairwise swaps).
create function public.admin_reorder_starters(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i int;
  n int := coalesce(array_length(p_ids, 1), 0);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if n <> (select count(*) from public.workouts where kind = 'starter')
     or n <> (select count(distinct x) from unnest(p_ids) as x)
     or exists (
       select 1 from unnest(p_ids) as x
       where not exists (select 1 from public.workouts w where w.id = x and w.kind = 'starter')
     )
  then
    raise exception 'reorder must list every starter workout exactly once' using errcode = '22023';
  end if;
  update public.workouts set starter_order = -starter_order where kind = 'starter';
  for i in 1 .. n loop
    update public.workouts set starter_order = i where id = p_ids[i];
  end loop;
end $$;
revoke execute on function public.admin_reorder_starters(uuid[]) from public, anon;
grant execute on function public.admin_reorder_starters(uuid[]) to authenticated;

-- RLS
alter table public.client_notes enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings enable row level security;

create policy client_notes_admin_select on public.client_notes for select to authenticated
  using ((select public.is_admin()));
create policy client_notes_admin_insert on public.client_notes for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

create policy audit_log_admin_select on public.audit_log for select to authenticated
  using ((select public.is_admin()));

create policy settings_admin_select on public.settings for select to authenticated
  using ((select public.is_admin()));
create policy settings_admin_insert on public.settings for insert to authenticated
  with check ((select public.is_admin()));
create policy settings_admin_update on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_admin_delete on public.settings for delete to authenticated
  using ((select public.is_admin()));

create policy workouts_admin_insert on public.workouts for insert to authenticated
  with check ((select public.is_admin()));
create policy workouts_admin_update on public.workouts for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Never erase history: only workouts nobody has completed can be deleted.
create policy workouts_admin_delete on public.workouts for delete to authenticated
  using (
    (select public.is_admin())
    and not exists (select 1 from public.workout_completions c where c.workout_id = workouts.id)
  );

create policy workout_media_admin_insert on public.workout_media for insert to authenticated
  with check ((select public.is_admin()));
create policy workout_media_admin_update on public.workout_media for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy workout_media_admin_delete on public.workout_media for delete to authenticated
  using ((select public.is_admin()));

create policy plans_admin_insert on public.plans for insert to authenticated
  with check ((select public.is_admin()));
create policy plans_admin_update on public.plans for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Admins may only manage manual (comp) grants; paid subscriptions belong to the payment provider.
create policy subscriptions_admin_insert on public.subscriptions for insert to authenticated
  with check ((select public.is_admin()) and provider = 'manual');
create policy subscriptions_admin_update on public.subscriptions for update to authenticated
  using ((select public.is_admin()) and provider = 'manual')
  with check ((select public.is_admin()) and provider = 'manual');

-- Grants (RLS above decides which rows; non-admins match no write policy).
revoke all on public.client_notes, public.audit_log, public.settings from anon;
revoke insert, update, delete on public.client_notes, public.audit_log, public.settings from authenticated;
grant select, insert on public.client_notes to authenticated;
grant select on public.audit_log to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant insert, update, delete on public.workouts, public.workout_media to authenticated;
grant insert, update on public.plans, public.subscriptions to authenticated;

-- Thumbnails: public read by URL, admin-only writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnails', 'thumbnails', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy thumbnails_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'thumbnails' and (select public.is_admin()));
create policy thumbnails_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'thumbnails' and (select public.is_admin()));
create policy thumbnails_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'thumbnails' and (select public.is_admin()));
