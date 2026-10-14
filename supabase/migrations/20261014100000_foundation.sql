-- Enums shared across the schema.
create type public.user_role as enum ('client', 'admin');
create type public.workout_level as enum ('beginner', 'advanced', 'pro');
create type public.workout_kind as enum ('free', 'starter', 'regular');
create type public.video_provider as enum ('youtube', 'vimeo', 'bunny');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'none');
create type public.payment_provider as enum ('stripe', 'revolut', 'manual');
create type public.feeling as enum ('easy', 'right', 'hard');
create type public.plan_interval as enum ('month', 'year');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '' check (char_length(name) <= 60),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{8,16}$'),
  phone_call_consent boolean not null default false,
  health_data_consent_at timestamptz,
  marketing_consent boolean not null default false,
  role public.user_role not null default 'client',
  level public.workout_level not null default 'beginner',
  height_cm smallint check (height_cm between 120 and 230),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 250),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 30 and 250),
  goal text check (goal in ('lose_weight', 'tone', 'strength', 'energy')),
  problems text[] not null default '{}',
  time_per_session text check (time_per_session in ('15', '20-30', '40+')),
  onboarding_done boolean not null default false,
  starter_week_done_at timestamptz,
  timezone text not null default 'Europe/Sofia' check (char_length(timezone) <= 64),
  first_utm jsonb,
  fbclid text,
  gclid text,
  last_seen_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- security definer: policies on profiles call this without recursing into RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke execute on function public.is_admin() from public;
-- anon too: the plans policy calls it for signed-out visitors (returns false for them).
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Users may only change these columns; role, starter progress, attribution stay server-side.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  name, phone, phone_call_consent, marketing_consent, health_data_consent_at, level,
  height_cm, weight_kg, target_weight_kg, goal, problems, time_per_session, timezone,
  onboarding_done
) on public.profiles to authenticated;

-- One profile per auth user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''), 60)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
