import { describe, expect, it } from "vitest";
import { stripeSubscriptionEvent } from "./fixtures/stripe-events";
import { mapStripeStatus, normalizeStripeEvent } from "./stripe-normalize";

describe("mapStripeStatus", () => {
  it.each([
    ["active", "active"],
    ["trialing", "trialing"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["canceled", "canceled"],
    ["incomplete", "none"],
    ["incomplete_expired", "none"],
    ["paused", "none"],
    ["something_new", "none"],
  ])("%s → %s", (input, expected) => {
    expect(mapStripeStatus(input)).toBe(expected);
  });
});

describe("normalizeStripeEvent", () => {
  it("normalises an updated subscription", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({
        id: "evt_1",
        created: 1_760_000_000,
        periodEnd: 1_762_000_000,
        unitAmount: 14900,
        interval: "year",
        priceId: "price_year",
      }),
    );
    expect(e).toEqual({
      provider: "stripe",
      eventId: "evt_1",
      type: "customer.subscription.updated",
      occurredAt: new Date(1_760_000_000_000).toISOString(),
      userId: "00000000-0000-4000-8000-000000000001",
      customerId: "cus_123",
      subscriptionId: "sub_123",
      status: "active",
      currentPeriodEnd: new Date(1_762_000_000_000).toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      priceId: "price_year",
      priceCents: 14900,
      interval: "year",
    });
  });

  it("reads the legacy top-level period end", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({ legacyPeriodEnd: true, periodEnd: 1_765_000_000 }),
    );
    expect(e?.currentPeriodEnd).toBe(new Date(1_765_000_000_000).toISOString());
  });

  it("marks a deleted subscription canceled and keeps when it ended", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({
        type: "customer.subscription.deleted",
        status: "canceled",
        endedAt: 1_761_000_000,
        canceledAt: 1_760_500_000,
      }),
    );
    expect(e).toMatchObject({
      status: "canceled",
      canceledAt: new Date(1_761_000_000_000).toISOString(),
    });
  });

  it("keeps cancel-at-period-end subscriptions active until they end", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({ cancelAtPeriodEnd: true, canceledAt: 1_760_500_000 }),
    );
    expect(e).toMatchObject({ status: "active", cancelAtPeriodEnd: true, canceledAt: null });
  });

  it("uses the real end time for an updated event that is already canceled", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({
        type: "customer.subscription.updated",
        status: "canceled",
        endedAt: 1_761_000_000,
        canceledAt: 1_760_500_000,
      }),
    );
    expect(e).toMatchObject({
      status: "canceled",
      canceledAt: new Date(1_761_000_000_000).toISOString(),
    });
  });

  it("does not take the cancellation request time as the end when ended_at is missing", () => {
    const e = normalizeStripeEvent(
      stripeSubscriptionEvent({
        type: "customer.subscription.deleted",
        status: "canceled",
        endedAt: null,
        canceledAt: 1_760_500_000,
      }),
    );
    expect(e?.canceledAt).toBeNull();
  });

  it("reads the customer id from an expanded customer object", () => {
    const e = normalizeStripeEvent(stripeSubscriptionEvent({ customer: { id: "cus_x" } }));
    expect(e?.customerId).toBe("cus_x");
  });

  it("accepts only a UUID as the user id", () => {
    expect(
      normalizeStripeEvent(stripeSubscriptionEvent({ userId: "not-a-uuid" }))?.userId,
    ).toBeNull();
    expect(normalizeStripeEvent(stripeSubscriptionEvent({ userId: "12345" }))?.userId).toBeNull();
    expect(
      normalizeStripeEvent(
        stripeSubscriptionEvent({ userId: "AAAAAAAA-0000-4000-8000-000000000001" }),
      )?.userId,
    ).toBe("AAAAAAAA-0000-4000-8000-000000000001");
  });

  it("returns null for events it does not handle and for a missing user id", () => {
    expect(normalizeStripeEvent(stripeSubscriptionEvent({ type: "invoice.paid" }))).toBeNull();
    expect(normalizeStripeEvent(stripeSubscriptionEvent({ userId: null }))?.userId).toBeNull();
  });
});
