-- Web Push: a member's browser subscriptions, her reminder hour, and a log of what the club sent.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Only the browsers' own push services: the server POSTs to this URL blindly.
  endpoint text not null unique check (
    char_length(endpoint) <= 2048 and endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.samsungosp\.com)/'
  ),
  p256dh text not null check (char_length(p256dh) <= 256),
  auth text not null check (char_length(auth) <= 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 256),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Rows are written by server code with the service role (the action validates the endpoint);
-- a member may only read and delete her own.
revoke all on public.push_subscriptions from anon;
revoke insert, update, delete on public.push_subscriptions from authenticated;
grant delete on public.push_subscriptions to authenticated;

-- Reminder hour in her own timezone (null = reminders off); the marker stops a second reminder
-- on the same local day and is written by the job only.
alter table public.profiles
  add column push_hour smallint check (push_hour between 0 and 23),
  add column push_reminded_on date;
grant update (push_hour) on public.profiles to authenticated;

-- `workouts.notified_at` (content migration) marks the "new workout" push. Everything published
-- before push existed counts as announced, so the first job run notifies nothing old.
update public.workouts set notified_at = publish_at
  where notified_at is null and publish_at is not null and publish_at <= now();

-- What the club sent, for the owner. Written by server code with the service role.
create table public.push_sends (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('broadcast', 'workout', 'reminder')),
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 200),
  url text check (url is null or char_length(url) <= 512),
  recipients integer not null default 0 check (recipients >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index push_sends_created on public.push_sends (created_at desc);

alter table public.push_sends enable row level security;
create policy push_sends_select on public.push_sends for select to authenticated
  using ((select public.is_admin()));
revoke all on public.push_sends from anon;
revoke insert, update, delete on public.push_sends from authenticated;

-- The hourly job runs from the database (pg_cron + pg_net), not from Vercel: the Hobby plan
-- allows daily crons only. It calls /api/cron/push with the bearer secret; both values live in
-- Vault (`app_url`, `cron_secret` — see README) and the job does nothing until they are set.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function public.run_push_cron() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/push',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 25000
  );
end $$;
revoke execute on function public.run_push_cron() from public, anon, authenticated;

select cron.schedule('push-hourly', '0 * * * *', $$select public.run_push_cron()$$);

-- For tests and the admin page: is the job scheduled?
create function public.push_cron_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('scheduled', true, 'schedule', j.schedule, 'active', j.active)
       from cron.job j where j.jobname = 'push-hourly' limit 1),
    jsonb_build_object('scheduled', false)
  );
$$;
revoke execute on function public.push_cron_status() from public, anon;
grant execute on function public.push_cron_status() to authenticated, service_role;
