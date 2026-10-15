import type { NormalizedSubscriptionEvent, PaidProvider } from "@/lib/payments/types";
import type { TypedClient } from "@/server/db/types";

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
    const { data } = await admin.from("profiles").select("id").eq("id", e.userId).maybeSingle();
    if (data) return data.id;
  }
  for (const [column, value] of [
    ["provider_sub_id", e.subscriptionId],
    ["provider_customer_id", e.customerId],
  ] as const) {
    if (!value) continue;
    const { data, error } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`find subscriber failed: ${error.message}`);
    if (data) return data.user_id;
  }
  return null;
}

/** Applies one provider event to the user's single subscription row. */
export async function applySubscriptionEvent(
  admin: TypedClient,
  e: NormalizedSubscriptionEvent,
): Promise<"applied" | "stale" | "no_user"> {
  const userId = await findUserId(admin, e);
  if (!userId) return "no_user";

  const { data: current, error: loadError } = await admin
    .from("subscriptions")
    .select("provider, status, grace_until, provider_event_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw new Error(`load subscription failed: ${loadError.message}`);
  if (
    current?.provider === e.provider &&
    current.provider_event_at &&
    Date.parse(current.provider_event_at) > Date.parse(e.occurredAt)
  ) {
    return "stale";
  }

  let planId: string | null = null;
  if (e.priceId) {
    const { data: plan } = await admin
      .from("plans")
      .select("id")
      .eq(`provider_price_ids->>${e.provider}`, e.priceId)
      .limit(1)
      .maybeSingle();
    planId = plan?.id ?? null;
  }

  const keepGrace =
    current?.provider === e.provider && current.status === "past_due" && current.grace_until;
  const grace_until =
    e.status === "past_due"
      ? keepGrace
        ? current!.grace_until
        : new Date(Date.parse(e.occurredAt) + GRACE_DAYS * 86_400_000).toISOString()
      : null;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: e.provider,
      provider_customer_id: e.customerId,
      provider_sub_id: e.subscriptionId,
      status: e.status,
      current_period_end: e.currentPeriodEnd,
      cancel_at_period_end: e.cancelAtPeriodEnd,
      canceled_at: e.status === "canceled" ? (e.canceledAt ?? e.occurredAt) : null,
      grace_until,
      plan_id: planId,
      price_cents: e.priceCents,
      billing_interval: e.interval,
      provider_event_at: e.occurredAt,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`apply subscription event failed: ${error.message}`);
  return "applied";
}
