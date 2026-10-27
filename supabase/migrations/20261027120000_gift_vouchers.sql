-- Gift vouchers: bought on /podari (Stripe) or issued by the owner; redeemed by a member for months
-- of manual access. Members never touch the table directly — redemption goes through the RPC.
create table public.gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$'),
  months smallint not null check (months in (1, 3, 12)),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  kind text not null check (kind in ('stripe', 'manual')),
  buyer_email text check (buyer_email is null or char_length(buyer_email) <= 254),
  recipient_name text check (recipient_name is null or char_length(recipient_name) <= 60),
  message text check (message is null or char_length(message) <= 300),
  stripe_session_id text unique check (stripe_session_id is null or char_length(stripe_session_id) <= 128),
  issued_by uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 months',
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz,
  -- Set by the owner after a refund or a mistake; a voided code can no longer be redeemed.
  voided_at timestamptz
);
create index gift_vouchers_created on public.gift_vouchers (created_at desc);

alter table public.gift_vouchers enable row level security;
create policy gift_vouchers_select on public.gift_vouchers for select to authenticated
  using ((select public.is_admin()));
revoke all on public.gift_vouchers from anon;
revoke insert, update, delete on public.gift_vouchers from authenticated;

-- A fresh unique code from the unambiguous alphabet (no 0/O, 1/I). Internal.
create function public.gift_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  i int;
begin
  for attempt in 1..20 loop
    v_bytes := extensions.gen_random_bytes(10);
    v_code := '';
    for i in 0..9 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) & 31) + 1, 1);
    end loop;
    if not exists (select 1 from public.gift_vouchers where code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a unique code';
end $$;
revoke execute on function public.gift_code() from public, anon, authenticated;

-- The owner hands out a free voucher (giveaway, apology). Returns the code.
create function public.issue_gift_voucher(p_months int, p_recipient_name text, p_note text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_months not in (1, 3, 12) then
    raise exception 'months must be 1, 3 or 12' using errcode = '22023';
  end if;
  v_code := public.gift_code();
  insert into public.gift_vouchers (code, months, amount_cents, kind, recipient_name, note, issued_by)
  values (v_code, p_months, 0, 'manual', nullif(btrim(coalesce(p_recipient_name, '')), ''),
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  return v_code;
end $$;
revoke execute on function public.issue_gift_voucher(int, text, text) from public, anon;
grant execute on function public.issue_gift_voucher(int, text, text) to authenticated;

-- A signed-in member redeems a code: her manual access is extended by the voucher's months
-- (from now, or from the end of a running manual period). The subscription rules are those of
-- admin_grant_manual (20261016100400): a live paid subscription is never replaced, a paid one
-- that is still billable (past_due beyond grace, still open at the provider) is never orphaned,
-- and the upsert re-checks liveness on the locked row. In those cases the code stays unused.
create function public.redeem_gift_voucher(p_code text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v public.gift_vouchers%rowtype;
  s public.subscriptions%rowtype;
  v_start timestamptz := now();
  v_end timestamptz;
  v_rows int;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  v_code := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if left(v_code, 3) = 'IAM' then
    v_code := substr(v_code, 4);
  end if;
  select * into v from public.gift_vouchers where code = v_code for update;
  if not found then
    raise exception 'voucher not found' using errcode = 'P0002';
  end if;
  if v.redeemed_at is not null then
    raise exception 'voucher already used' using errcode = 'P0001';
  end if;
  if v.voided_at is not null then
    raise exception 'voucher voided' using errcode = 'P0001';
  end if;
  if v.expires_at <= now() then
    raise exception 'voucher expired' using errcode = 'P0001';
  end if;
  select * into s from public.subscriptions where user_id = v_uid for update;
  if found then
    if s.provider <> 'manual' and public.has_active_access(v_uid) then
      raise exception 'paid subscription is live' using errcode = '23P01';
    end if;
    if s.provider <> 'manual' and s.provider_sub_id is not null and s.status <> 'canceled' then
      raise exception 'paid subscription still open' using errcode = 'P0003';
    end if;
    if s.provider = 'manual' and s.status = 'active'
       and s.current_period_end is not null and s.current_period_end > now() then
      v_start := s.current_period_end;
    end if;
  end if;
  v_end := v_start + make_interval(months => v.months);
  insert into public.subscriptions as t (user_id, provider, status, current_period_end, grace_until, canceled_at,
                                         cancel_at_period_end, plan_id, provider_customer_id, provider_sub_id,
                                         price_cents, billing_interval, provider_event_at)
  values (v_uid, 'manual', 'active', v_end, null, null, false, null, null, null, null, null, null)
  on conflict (user_id) do update set
    provider = 'manual', status = 'active', current_period_end = excluded.current_period_end,
    grace_until = null, canceled_at = null, cancel_at_period_end = false, plan_id = null,
    provider_sub_id = null, price_cents = null, billing_interval = null, provider_event_at = null
  where t.provider = 'manual'
     or not coalesce(
          t.status in ('active', 'trialing')
          or (t.status = 'past_due' and t.grace_until > now())
          or (t.status = 'canceled' and t.current_period_end > now()),
          false);
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'paid subscription is live' using errcode = '23P01';
  end if;
  update public.gift_vouchers set redeemed_by = v_uid, redeemed_at = now() where id = v.id;
  return v_end;
end $$;
revoke execute on function public.redeem_gift_voucher(text) from public, anon;
grant execute on function public.redeem_gift_voucher(text) to authenticated;

-- The owner cancels an unredeemed voucher (refund, mistake).
create function public.void_gift_voucher(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.gift_vouchers set voided_at = now()
    where id = p_id and redeemed_at is null and voided_at is null;
  if not found then
    raise exception 'voucher not found or already used' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.void_gift_voucher(uuid) from public, anon;
grant execute on function public.void_gift_voucher(uuid) to authenticated;
