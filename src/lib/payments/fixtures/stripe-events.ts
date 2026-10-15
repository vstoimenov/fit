import type Stripe from "stripe";

/** A minimal customer.subscription.* event shaped like Stripe's API (basil+: period on items). */
export function stripeSubscriptionEvent(
  over: {
    type?: string;
    id?: string;
    created?: number;
    status?: string;
    userId?: string | null;
    customer?: string | { id: string };
    periodEnd?: number;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: number | null;
    endedAt?: number | null;
    priceId?: string;
    unitAmount?: number;
    interval?: "month" | "year";
    legacyPeriodEnd?: boolean;
  } = {},
): Stripe.Event {
  const periodEnd = over.periodEnd ?? 1_800_000_000;
  const subscription = {
    id: "sub_123",
    object: "subscription",
    customer: over.customer ?? "cus_123",
    status: over.status ?? "active",
    cancel_at_period_end: over.cancelAtPeriodEnd ?? false,
    canceled_at: over.canceledAt ?? null,
    ended_at: over.endedAt ?? null,
    metadata:
      over.userId === null
        ? {}
        : { user_id: over.userId ?? "00000000-0000-4000-8000-000000000001" },
    ...(over.legacyPeriodEnd ? { current_period_end: periodEnd } : {}),
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          ...(over.legacyPeriodEnd ? {} : { current_period_end: periodEnd }),
          price: {
            id: over.priceId ?? "price_month",
            unit_amount: over.unitAmount ?? 1990,
            currency: "eur",
            recurring: { interval: over.interval ?? "month" },
          },
        },
      ],
    },
  };
  return {
    id: over.id ?? `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: over.type ?? "customer.subscription.updated",
    created: over.created ?? 1_760_000_000,
    data: { object: subscription },
  } as unknown as Stripe.Event;
}
