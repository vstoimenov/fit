import type { NormalizedSubscriptionEvent, PaidProvider } from "@/lib/payments/types";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

/** Days of access kept after a failed renewal. The same value lives in public.apply_subscription_event. */
export const GRACE_DAYS = 3;

/** Stores the raw webhook once. "seen" = already processed; "retry" = stored but not processed yet. */
export async function recordPaymentEvent(
  admin: TypedClient,
  e: {
    provider: PaidProvider;
    eventId: string;
    type: string;
    userId: string | null;
    payload: unknown;
  },
): Promise<"new" | "seen" | "retry"> {
  const { error } = await admin.from("payment_events").insert({
    provider: e.provider,
    event_id: e.eventId,
    type: e.type.slice(0, 100),
    user_id: e.userId,
    payload: e.payload as never,
  });
  if (!error) return "new";
  if (error.code !== "23505") throw new Error(`store payment event failed: ${error.message}`);
  const { data, error: loadError } = await admin
    .from("payment_events")
    .select("processed_at")
    .eq("provider", e.provider)
    .eq("event_id", e.eventId)
    .single();
  if (loadError) throw new Error(`load payment event failed: ${loadError.message}`);
  return data.processed_at ? "seen" : "retry";
}

export async function markPaymentEvent(
  admin: TypedClient,
  provider: PaidProvider,
  eventId: string,
  errorText: string | null,
): Promise<void> {
  const { error } = await admin
    .from("payment_events")
    .update({ processed_at: new Date().toISOString(), error: errorText?.slice(0, 1000) ?? null })
    .eq("provider", provider)
    .eq("event_id", eventId);
  if (error) throw new Error(`mark payment event failed: ${error.message}`);
}

async function findUserId(
  admin: TypedClient,
  e: NormalizedSubscriptionEvent,
): Promise<string | null> {
  if (e.userId) {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("id", e.userId)
      .maybeSingle();
    if (error) throw new Error(`find profile failed: ${error.message}`);
    if (data) return data.id;
  }
  // A customer id outlives the paid subscription: admin_grant_manual keeps it on the row it turns manual.
  const lookups = [
    ["provider_sub_id", e.subscriptionId, [e.provider]],
    ["provider_customer_id", e.customerId, [e.provider, "manual"]],
  ] as const;
  for (const [column, value, providers] of lookups) {
    if (!value) continue;
    const { data, error } = await admin
      .from("subscriptions")
      .select("user_id")
      .in("provider", [...providers])
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`find subscriber failed: ${error.message}`);
    if (data) return data.user_id;
  }
  return null;
}

/** The user's stored subscription before an event is applied, with whether it still gives access. */
export interface PreviousSubscription {
  provider: string;
  subscriptionId: string | null;
  live: boolean;
}

export async function previousSubscription(
  admin: TypedClient,
  e: NormalizedSubscriptionEvent,
): Promise<PreviousSubscription | null> {
  const userId = await findUserId(admin, e);
  if (!userId) return null;
  const { data: row, error } = await admin
    .from("subscriptions")
    .select("provider, provider_sub_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`load previous subscription failed: ${error.message}`);
  if (!row) return null;
  const { data: live, error: liveError } = await admin.rpc("has_active_access", { uid: userId });
  if (liveError) throw new Error(`check previous access failed: ${liveError.message}`);
  return { provider: row.provider, subscriptionId: row.provider_sub_id, live: live === true };
}

type ApplyArgs = Database["public"]["Functions"]["apply_subscription_event"]["Args"];

/**
 * Applies one provider event to the user's single subscription row. The ordering, grace-period and
 * different-subscription rules run inside public.apply_subscription_event, in one statement, so
 * concurrent webhooks cannot interleave. Events with the same timestamp apply in arrival order;
 * callers that need the exact current state must re-fetch it from the provider.
 */
export async function applySubscriptionEvent(
  admin: TypedClient,
  e: NormalizedSubscriptionEvent,
): Promise<"applied" | "stale" | "ignored" | "no_user"> {
  const userId = await findUserId(admin, e);
  if (!userId) return "no_user";

  let planId: string | null = null;
  if (e.priceId) {
    const { data: plan, error } = await admin
      .from("plans")
      .select("id")
      .eq(`provider_price_ids->>${e.provider}`, e.priceId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`find plan failed: ${error.message}`);
    planId = plan?.id ?? null;
  }

  // The generated argument types are all non-null; the function accepts null for these.
  const args = {
    p_user_id: userId,
    p_provider: e.provider,
    p_customer_id: e.customerId,
    p_sub_id: e.subscriptionId,
    p_status: e.status,
    p_period_end: e.currentPeriodEnd,
    p_cancel_at_period_end: e.cancelAtPeriodEnd,
    p_canceled_at: e.canceledAt,
    p_plan_id: planId,
    p_price_cents: e.priceCents,
    p_interval: e.interval,
    p_event_at: e.occurredAt,
  } as unknown as ApplyArgs;
  const { data, error } = await admin.rpc("apply_subscription_event", args);
  if (error) throw new Error(`apply subscription event failed: ${error.message}`);
  if (data !== "applied" && data !== "stale" && data !== "ignored") {
    throw new Error(`apply subscription event returned ${String(data)}`);
  }
  return data;
}
