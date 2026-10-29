-- In-person trainings („На място“): weekly slots → dated sessions, punch cards, bookings.
-- Every count changes only through security-definer functions (later migrations), never by direct writes.

alter table public.profiles add column studio_client boolean not null default false;

create table public.studio_slots (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time time not null,
  duration_min smallint not null default 60 check (duration_min between 15 and 180),
  title text not null check (char_length(title) between 2 and 80),
  capacity smallint not null check (capacity between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger studio_slots_updated_at before update on public.studio_slots
  for each row execute function public.set_updated_at();
create trigger studio_slots_audit after insert or update or delete on public.studio_slots
  for each row execute function public.audit_row('id');

create table public.studio_sessions (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references public.studio_slots (id) on delete set null,
  starts_at timestamptz not null,
  duration_min smallint not null check (duration_min between 15 and 180),
  title text not null check (char_length(title) between 2 and 80),
  capacity smallint not null check (capacity between 1 and 100),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (slot_id, starts_at)
);
create index studio_sessions_starts on public.studio_sessions (starts_at);
create trigger studio_sessions_audit after insert or update or delete on public.studio_sessions
  for each row execute function public.audit_row('id');

create table public.studio_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('card8', 'card12')),
  visits smallint not null check (visits > 0),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  -- Visits already used before the card entered the app (moved over from the notebook).
  used_before smallint not null default 0 check (used_before >= 0 and used_before < visits),
  voided_at timestamptz,
  warned_low_at timestamptz,
  warned_expiry_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index studio_cards_user on public.studio_cards (user_id, ends_on);
create trigger studio_cards_audit after insert or update or delete on public.studio_cards
  for each row execute function public.audit_row('id');

create table public.studio_card_adjustments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.studio_cards (id) on delete cascade,
  delta smallint not null check (delta <> 0),
  reason text not null check (char_length(reason) between 2 and 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index studio_card_adjustments_card on public.studio_card_adjustments (card_id);
create trigger studio_card_adjustments_audit after insert or update or delete
  on public.studio_card_adjustments for each row execute function public.audit_row('id');

create table public.studio_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.studio_sessions (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid references public.studio_cards (id) on delete restrict,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  source text not null check (source in ('client', 'admin')),
  over_limit boolean not null default false,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null
);
create unique index studio_bookings_one_per_session on public.studio_bookings (session_id, user_id)
  where status = 'booked';
create index studio_bookings_user on public.studio_bookings (user_id, created_at desc);
create index studio_bookings_card on public.studio_bookings (card_id) where status = 'booked';
create trigger studio_bookings_audit after insert or update or delete on public.studio_bookings
  for each row execute function public.audit_row('id');

-- Remaining visits per card, read with the caller's RLS.
create view public.studio_card_status with (security_invoker = true) as
select
  c.id, c.user_id, c.kind, c.visits, c.starts_on, c.ends_on, c.used_before, c.voided_at,
  c.warned_low_at, c.warned_expiry_at, c.created_at,
  coalesce(a.adjusted, 0)::int as adjusted,
  coalesce(b.booked, 0)::int as booked,
  (c.visits - c.used_before + coalesce(a.adjusted, 0) - coalesce(b.booked, 0))::int as remaining
from public.studio_cards c
left join lateral (
  select sum(x.delta) as adjusted from public.studio_card_adjustments x where x.card_id = c.id
) a on true
left join lateral (
  select count(*) as booked from public.studio_bookings y where y.card_id = c.id and y.status = 'booked'
) b on true;

alter table public.studio_slots enable row level security;
alter table public.studio_sessions enable row level security;
alter table public.studio_cards enable row level security;
alter table public.studio_card_adjustments enable row level security;
alter table public.studio_bookings enable row level security;

create policy studio_slots_admin_select on public.studio_slots for select to authenticated
  using ((select public.is_admin()));
create policy studio_slots_admin_insert on public.studio_slots for insert to authenticated
  with check ((select public.is_admin()));
create policy studio_slots_admin_update on public.studio_slots for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy studio_slots_admin_delete on public.studio_slots for delete to authenticated
  using ((select public.is_admin()));

-- Dated sessions carry no personal data: the public schedule may read them.
create policy studio_sessions_select on public.studio_sessions for select to anon, authenticated
  using (true);

create policy studio_cards_select on public.studio_cards for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy studio_card_adjustments_select on public.studio_card_adjustments for select
  to authenticated using (
    (select public.is_admin())
    or exists (
      select 1 from public.studio_cards c where c.id = card_id and c.user_id = (select auth.uid())
    )
  );
create policy studio_bookings_select on public.studio_bookings for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.studio_slots, public.studio_sessions, public.studio_cards,
  public.studio_card_adjustments, public.studio_bookings, public.studio_card_status
  from anon, authenticated;
grant select on public.studio_slots to authenticated;
grant insert (weekday, start_time, duration_min, title, capacity, active)
  on public.studio_slots to authenticated;
grant update (weekday, start_time, duration_min, title, capacity, active)
  on public.studio_slots to authenticated;
grant delete on public.studio_slots to authenticated;
grant select on public.studio_sessions to anon, authenticated;
grant select on public.studio_cards, public.studio_card_adjustments, public.studio_bookings,
  public.studio_card_status to authenticated;

-- The public schedule with booked counts (counts only, never who).
create function public.studio_schedule(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, title text, starts_at timestamptz, duration_min smallint, capacity smallint,
  booked int, cancelled boolean
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.title, s.starts_at, s.duration_min, s.capacity,
    (select count(*) from public.studio_bookings b where b.session_id = s.id and b.status = 'booked')::int,
    s.cancelled_at is not null
  from public.studio_sessions s
  where s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at, s.id
$$;
revoke execute on function public.studio_schedule(timestamptz, timestamptz) from public;
grant execute on function public.studio_schedule(timestamptz, timestamptz) to anon, authenticated;

-- Materialises the coming days from the active weekly slots (Sofia wall-clock time). Idempotent.
-- p_today exists for tests; production calls it without arguments.
create function public.studio_ensure_sessions(p_days int default 14, p_today date default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Europe/Sofia')::date);
begin
  insert into public.studio_sessions (slot_id, starts_at, duration_min, title, capacity)
  select sl.id, (d::date + sl.start_time) at time zone 'Europe/Sofia', sl.duration_min, sl.title,
    sl.capacity
  from public.studio_slots sl
  cross join generate_series(v_today, v_today + (greatest(p_days, 1) - 1), interval '1 day') d
  where sl.active and extract(isodow from d) = sl.weekday
  on conflict (slot_id, starts_at) do nothing;
end $$;
revoke execute on function public.studio_ensure_sessions(int, date) from public, anon, authenticated;
