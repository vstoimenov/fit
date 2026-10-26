-- Leads from the public site (name + e-mail given to unlock the free workout).
-- Written only through submit_lead(); read only by admins.

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
create index leads_ip_recent on public.leads (ip_hash, created_at) where ip_hash is not null;
create index leads_created on public.leads (created_at desc);

alter table public.leads enable row level security;
create policy leads_admin_select on public.leads for select to authenticated
  using ((select public.is_admin()));
-- No insert/update/delete policies: the app never writes directly, only via submit_lead().
-- Tighten the default grants too: anon touches the table only through the function.
revoke all on public.leads from anon;
revoke insert, update, delete on public.leads from authenticated;

-- Upsert by e-mail (normalised), refuse more than 10 new leads per ip hash per hour.
create function public.submit_lead(
  p_name text,
  p_email text,
  p_marketing boolean,
  p_source text,
  p_ip_hash text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_name text := btrim(p_name);
  v_ip text := nullif(p_ip_hash, '');  -- the app sends '' when it has no ip
begin
  if v_ip is not null and (
    select count(*) from public.leads
    where ip_hash = v_ip and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.leads (name, email, marketing_consent_at, source, ip_hash)
  values (v_name, v_email, case when p_marketing then now() end, btrim(p_source), v_ip)
  on conflict (email) do update set
    name = excluded.name,
    source = excluded.source,
    marketing_consent_at = coalesce(public.leads.marketing_consent_at, excluded.marketing_consent_at),
    updated_at = now();
end $$;
revoke execute on function public.submit_lead(text, text, boolean, text, text) from public;
grant execute on function public.submit_lead(text, text, boolean, text, text) to anon, authenticated;
