import type Stripe from "stripe";
import type { NormalizedSubscriptionEvent, SubscriptionStatus } from "./types";

const HANDLED = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "none";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toIso = (seconds: number | null | undefined) =>
  typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;

type LooseSubscription = Stripe.Subscription & { current_period_end?: number };
type LooseItem = Stripe.SubscriptionItem & { current_period_end?: number };

/** Subscription lifecycle events only; everything else is ignored (null). */
export function normalizeStripeEvent(event: Stripe.Event): NormalizedSubscriptionEvent | null {
  if (!HANDLED.has(event.type)) return null;
  const sub = event.data.object as LooseSubscription;
  const item = sub.items?.data?.[0] as LooseItem | undefined;
  const price = item?.price;
  const status =
    event.type === "customer.subscription.deleted" ? "canceled" : mapStripeStatus(sub.status);
  const rawUserId = sub.metadata?.user_id;
  const userId = typeof rawUserId === "string" && UUID.test(rawUserId) ? rawUserId : null;
  const interval = price?.recurring?.interval;
  return {
    provider: "stripe",
    eventId: event.id,
    type: event.type,
    occurredAt: new Date(event.created * 1000).toISOString(),
    userId,
    customerId: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    subscriptionId: sub.id,
    status,
    currentPeriodEnd: toIso(item?.current_period_end ?? sub.current_period_end),
    // The portal's "cancel at a date" sets cancel_at without cancel_at_period_end: it will not renew either.
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at != null),
    canceledAt: status === "canceled" ? toIso(sub.ended_at) : null,
    priceId: price?.id ?? null,
    priceCents: typeof price?.unit_amount === "number" ? price.unit_amount : null,
    interval: interval === "month" ? "month" : interval === "year" ? "year" : null,
  };
}
