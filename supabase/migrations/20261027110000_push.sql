-- Web Push: a member's browser subscriptions, her reminder hour, and a log of what the club sent.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
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
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon;
revoke insert, update, delete on public.push_subscriptions from authenticated;
grant insert (endpoint, p256dh, auth, user_agent) on public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;

-- Reminder hour in her own timezone (null = reminders off); the marker stops a second reminder
-- on the same local day and is written by the job only.
alter table public.profiles
  add column push_hour smallint check (push_hour between 0 and 23),
  add column push_reminded_on date;
grant update (push_hour) on public.profiles to authenticated;

-- `workouts.notified_at` (content migration) marks the "new workout" push. Everything published
-- before push existed counts as announced, so the first job run notifies nothing old.
update public.workouts set notified_at = coalesce(publish_at, now()) where notified_at is null;

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
