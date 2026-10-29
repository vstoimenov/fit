-- Joining as an in-person client, and invites that hand a trainer-created walk-in profile its own
-- login (the card and history stay on the same profile).

create function public.studio_join(p_name text, p_phone text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles
  set name = left(btrim(p_name), 60), phone = btrim(p_phone), studio_client = true
  where id = v_uid;
end $$;
revoke execute on function public.studio_join(text, text) from public, anon;
grant execute on function public.studio_join(text, text) to authenticated;

-- Only the sha-256 of the token is stored; reached through the service role only.
create table public.studio_invites (
  token_hash text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index studio_invites_user on public.studio_invites (user_id);
alter table public.studio_invites enable row level security;
revoke all on public.studio_invites from anon, authenticated;
