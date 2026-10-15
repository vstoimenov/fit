-- Applies one normalised provider event to the user's single subscription row, atomically.
-- The ON CONFLICT row lock makes the guard see the latest committed row, so concurrent webhooks
-- cannot let an older event overwrite a newer one (the old read-then-upsert in the app could).
--
-- Returns 'applied' | 'stale' (older than what is stored) | 'ignored' (a canceled/dead event for a
-- different subscription than the one that currently grants access).
-- Ties on the event time apply: the last writer wins, so the caller must re-fetch current state
-- from the provider when the order of same-second events matters.
create function public.apply_subscription_event(
  p_user_id uuid,
  p_provider public.payment_provider,
  p_customer_id text,
  p_sub_id text,
  p_status public.subscription_status,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_plan_id uuid,
  p_price_cents int,
  p_interval public.plan_interval,
  p_event_at timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_canceled_at timestamptz := case when p_status = 'canceled' then coalesce(p_canceled_at, p_event_at) end;
  v_period_end timestamptz := case when p_status = 'canceled' then least(p_period_end, v_canceled_at) else p_period_end end;
  v_incoming_live boolean := p_status in ('active', 'trialing', 'past_due');
  v_rows int;
  s public.subscriptions%rowtype;
begin
  insert into public.subscriptions as t (user_id, provider, provider_customer_id, provider_sub_id, status,
                                         current_period_end, cancel_at_period_end, canceled_at, grace_until,
                                         plan_id, price_cents, billing_interval, provider_event_at)
  values (p_user_id, p_provider, p_customer_id, p_sub_id, p_status, v_period_end, p_cancel_at_period_end,
          v_canceled_at,
          case when p_status = 'past_due' then p_event_at + interval '3 days' end,
          p_plan_id, p_price_cents, p_interval, p_event_at)
  on conflict (user_id) do update set
    provider = p_provider,
    provider_customer_id = p_customer_id,
    provider_sub_id = p_sub_id,
    status = p_status,
    current_period_end = v_period_end,
    cancel_at_period_end = p_cancel_at_period_end,
    canceled_at = v_canceled_at,
    grace_until = case
      when p_status <> 'past_due' then null
      when t.status = 'past_due' and t.provider = p_provider and t.grace_until is not null then t.grace_until
      else p_event_at + interval '3 days'
    end,
    plan_id = p_plan_id,
    price_cents = p_price_cents,
    billing_interval = p_interval,
    provider_event_at = p_event_at
  where
    -- time guard: only a strictly older event from the same provider is stale
    (t.provider is distinct from p_provider or t.provider_event_at is null or t.provider_event_at <= p_event_at)
    -- different-subscription rule: while another subscription (or a manual grant) is live, only an
    -- event that is itself live may replace it; a dead one belongs to a subscription we moved on from
    and (
      v_incoming_live
      or not (
        -- keep in sync with public.has_active_access
        coalesce(
          (
            t.status in ('active', 'trialing')
            and not (t.provider = 'manual' and t.current_period_end is not null and t.current_period_end <= now())
          )
          or (t.status = 'past_due' and t.grace_until > now())
          or (t.status = 'canceled' and t.current_period_end > now()),
          false)
        and (t.provider_sub_id is distinct from p_sub_id or t.provider is distinct from p_provider)
      )
    );
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    return 'applied';
  end if;
  select * into s from public.subscriptions where user_id = p_user_id;
  if not found
     or (s.provider = p_provider and s.provider_event_at is not null and s.provider_event_at > p_event_at) then
    return 'stale';
  end if;
  return 'ignored';
end $$;
revoke execute on function public.apply_subscription_event(uuid, public.payment_provider, text, text,
  public.subscription_status, timestamptz, boolean, timestamptz, uuid, int, public.plan_interval, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, public.payment_provider, text, text,
  public.subscription_status, timestamptz, boolean, timestamptz, uuid, int, public.plan_interval, timestamptz)
  to service_role;
