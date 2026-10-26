-- Leads from the public site (name + e-mail given to unlock the free workout).
-- Written only through submit_lead() with the service role; read only by admins.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  email text not null unique check (email = lower(btrim(email)) and position('@' in email) > 1),
  marketing_consent_at timestamptz,
  source text not null check (char_length(source) between 1 and 40),
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_ip_recent on public.leads (ip_hash, updated_at) where ip_hash is not null;
create index leads_created on public.leads (created_at desc);

alter table public.leads enable row level security;
create policy leads_admin_select on public.leads for select to authenticated
  using ((select public.is_admin()));
-- No insert/update/delete policies: the app never writes directly, only via submit_lead().
-- Tighten the default grants too: anon never touches the table.
revoke all on public.leads from anon;
revoke insert, update, delete on public.leads from authenticated;

-- Upsert by e-mail (normalised). Returns true when the e-mail is new (the app sends the welcome
-- e-mail only then), false when an existing row was refreshed. Refuses more than 10 rows
-- touched per ip hash per hour, and forgets ip hashes older than 30 days.
-- Callable only with the service role: the server action supplies a trustworthy ip hash and
-- the honeypot check; a public grant would let anyone pick their own hash.
create function public.submit_lead(
  p_name text,
  p_email text,
  p_marketing boolean,
  p_source text,
  p_ip_hash text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_name text := btrim(p_name);
  v_ip text := nullif(p_ip_hash, '');  -- the app sends '' when it has no ip
  v_inserted boolean;
begin
  update public.leads set ip_hash = null
   where ip_hash is not null and created_at < now() - interval '30 days';

  if v_ip is not null and (
    select count(*) from public.leads
    where ip_hash = v_ip and updated_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.leads (name, email, marketing_consent_at, source, ip_hash)
  values (v_name, v_email, case when p_marketing then now() end, btrim(p_source), v_ip)
  on conflict (email) do update set
    name = excluded.name,
    source = excluded.source,
    marketing_consent_at = coalesce(public.leads.marketing_consent_at, excluded.marketing_consent_at),
    ip_hash = coalesce(excluded.ip_hash, public.leads.ip_hash),
    updated_at = now()
  returning (xmax = 0) into v_inserted;

  return v_inserted;
end $$;
revoke execute on function public.submit_lead(text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.submit_lead(text, text, boolean, text, text) to service_role;
