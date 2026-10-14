create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  kind public.workout_kind not null default 'regular',
  level public.workout_level,
  duration_min smallint not null check (duration_min between 1 and 180),
  focus text[] not null default '{}',
  -- Our own image only: a provider thumbnail URL carries the video ID and would leak it.
  thumbnail_url text check (
    thumbnail_url is null
    or thumbnail_url !~* '(ytimg|youtube|youtu\.be|vimeo|mediadelivery|b-cdn)'
  ),
  starter_order smallint,
  publish_at timestamptz,
  notify boolean not null default true,
  notified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_level_rule check ((kind = 'regular') = (level is not null)),
  constraint workouts_starter_rule check ((kind = 'starter') = (starter_order is not null))
);

create unique index workouts_single_free on public.workouts (kind) where kind = 'free';
create unique index workouts_starter_order on public.workouts (starter_order) where kind = 'starter';
create index workouts_level_publish on public.workouts (level, publish_at desc);

create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

-- Video URLs live apart from metadata so RLS can hide them from users without access.
create table public.workout_media (
  workout_id uuid primary key references public.workouts (id) on delete cascade,
  provider public.video_provider not null,
  video_url text not null check (char_length(video_url) <= 500)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  interval public.plan_interval not null,
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  provider_price_ids jsonb not null default '{}',
  active boolean not null default true,
  sort smallint not null default 0
);

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  provider public.payment_provider not null,
  provider_customer_id text,
  provider_sub_id text,
  status public.subscription_status not null default 'none',
  current_period_end timestamptz,
  grace_until timestamptz,
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Service-only: tells whether a given user may watch paid content right now.
create function public.has_active_access(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and (
        s.status in ('active', 'trialing')
        or (s.status = 'past_due' and s.grace_until > now())
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  );
$$;
revoke execute on function public.has_active_access(uuid) from public, anon, authenticated;

create function public.can_watch(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id
      and (
        public.is_admin()
        or (
          w.publish_at is not null and w.publish_at <= now()
          and (w.kind = 'free' or public.has_active_access((select auth.uid())))
        )
      )
  );
$$;
revoke execute on function public.can_watch(uuid) from public, anon;
grant execute on function public.can_watch(uuid) to authenticated;

create function public.my_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_active_access((select auth.uid()));
$$;
revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- Countdown on the Today screen: when the next workout of a level goes live (time only, no content).
create function public.next_drop_at(p_level public.workout_level) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select min(publish_at) from public.workouts
  where kind = 'regular' and level = p_level and publish_at > now();
$$;
revoke execute on function public.next_drop_at(public.workout_level) from public, anon;
grant execute on function public.next_drop_at(public.workout_level) to authenticated;

alter table public.workouts enable row level security;
alter table public.workout_media enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

create policy workouts_select on public.workouts for select to authenticated
  using ((select public.is_admin()) or (publish_at is not null and publish_at <= now()));

create policy workout_media_select on public.workout_media for select to authenticated
  using (public.can_watch(workout_id));

create policy plans_select on public.plans for select to anon, authenticated
  using (active or (select public.is_admin()));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Writes come from the service role (seed, admin panel in 1B, webhooks in 1C).
revoke insert, update, delete on public.workouts, public.workout_media, public.plans, public.subscriptions
  from anon, authenticated;
