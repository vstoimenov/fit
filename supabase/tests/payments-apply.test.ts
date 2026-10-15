import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NormalizedSubscriptionEvent } from "@/lib/payments/types";
import {
  applySubscriptionEvent,
  markPaymentEvent,
  recordPaymentEvent,
} from "@/server/payments/apply-event";
import { adminClient, createUser, grantAccess, type TypedClient } from "./helpers";

let admin: TypedClient;
let planId: string;
let priceId: string;
const day = 86_400_000;

// Own plan with a unique price id: the database also holds monthly plans left by other tests.
beforeAll(async () => {
  admin = adminClient();
  priceId = `price_test_${crypto.randomUUID()}`;
  const { data, error } = await admin
    .from("plans")
    .insert({
      name: `apply-${priceId.slice(-8)}`,
      interval: "month",
      price_cents: 1990,
      active: false,
      provider_price_ids: { stripe: priceId },
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  planId = data!.id;
});

afterAll(async () => {
  await admin.from("plans").delete().eq("id", planId);
});

function event(
  userId: string,
  over: Partial<NormalizedSubscriptionEvent> = {},
): NormalizedSubscriptionEvent {
  return {
    provider: "stripe",
    eventId: `evt_${crypto.randomUUID()}`,
    type: "customer.subscription.updated",
    occurredAt: new Date().toISOString(),
    userId,
    customerId: `cus_${userId.slice(0, 8)}`,
    subscriptionId: `sub_${userId.slice(0, 8)}`,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * day).toISOString(),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    priceId,
    priceCents: 1990,
    interval: "month",
    ...over,
  };
}

async function row(userId: string) {
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function access(userId: string) {
  return (await admin.rpc("has_active_access", { uid: userId })).data === true;
}

describe("recordPaymentEvent", () => {
  it("reports new, retry and seen", async () => {
    const id = `evt_${crypto.randomUUID()}`;
    const e = {
      provider: "stripe" as const,
      eventId: id,
      type: "t",
      userId: null,
      payload: { a: 1 },
    };
    expect(await recordPaymentEvent(admin, e)).toBe("new");
    expect(await recordPaymentEvent(admin, e)).toBe("retry");
    await markPaymentEvent(admin, "stripe", id, null);
    expect(await recordPaymentEvent(admin, e)).toBe("seen");
  });
});

describe("applySubscriptionEvent", () => {
  it("activates a new subscriber with the plan and the price snapshot", async () => {
    const user = await createUser(admin, "pay-new");
    expect(await applySubscriptionEvent(admin, event(user.id))).toBe("applied");
    const r = await row(user.id);
    expect(r).toMatchObject({
      provider: "stripe",
      status: "active",
      price_cents: 1990,
      billing_interval: "month",
      cancel_at_period_end: false,
    });
    expect(r.plan_id).toBe(planId);
    expect(await access(user.id)).toBe(true);
  });

  it("leaves the plan empty for a price no plan knows, instead of picking some other plan", async () => {
    const user = await createUser(admin, "pay-unknown-price");
    await applySubscriptionEvent(
      admin,
      event(user.id, { priceId: `price_unknown_${crypto.randomUUID()}` }),
    );
    expect((await row(user.id)).plan_id).toBeNull();
  });

  it("replaces a manual grant with the paid subscription", async () => {
    const user = await createUser(admin, "pay-over-manual");
    await grantAccess(admin, user.id);
    await applySubscriptionEvent(admin, event(user.id));
    expect((await row(user.id)).provider).toBe("stripe");
  });

  it("ignores an older event that arrives after a newer one", async () => {
    const user = await createUser(admin, "pay-order");
    const newer = event(user.id, {
      occurredAt: new Date(Date.now() - 1000).toISOString(),
      status: "canceled",
      canceledAt: new Date().toISOString(),
    });
    const older = event(user.id, {
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
      status: "active",
    });
    expect(await applySubscriptionEvent(admin, newer)).toBe("applied");
    expect(await applySubscriptionEvent(admin, older)).toBe("stale");
    expect((await row(user.id)).status).toBe("canceled");
  });

  it("gives 3 days of grace on a failed renewal, keeps it on retries and clears it after payment", async () => {
    const user = await createUser(admin, "pay-grace");
    await applySubscriptionEvent(
      admin,
      event(user.id, { occurredAt: new Date(Date.now() - 3000).toISOString() }),
    );
    await applySubscriptionEvent(
      admin,
      event(user.id, { status: "past_due", occurredAt: new Date(Date.now() - 2000).toISOString() }),
    );
    const first = (await row(user.id)).grace_until!;
    expect(Date.parse(first) - Date.now()).toBeGreaterThan(2.9 * day);
    expect(await access(user.id)).toBe(true);
    await applySubscriptionEvent(
      admin,
      event(user.id, { status: "past_due", occurredAt: new Date(Date.now() - 1000).toISOString() }),
    );
    expect((await row(user.id)).grace_until).toBe(first);
    await applySubscriptionEvent(admin, event(user.id, { status: "active" }));
    expect((await row(user.id)).grace_until).toBeNull();
  });

  it("keeps access after a cancel-at-period-end and records the real end on deletion", async () => {
    const user = await createUser(admin, "pay-cancel");
    const end = new Date(Date.now() + 5 * day).toISOString();
    await applySubscriptionEvent(
      admin,
      event(user.id, {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: end,
        occurredAt: new Date(Date.now() - 2000).toISOString(),
      }),
    );
    expect(await row(user.id)).toMatchObject({
      status: "active",
      cancel_at_period_end: true,
      canceled_at: null,
    });
    expect(await access(user.id)).toBe(true);
    const endedAt = new Date().toISOString();
    await applySubscriptionEvent(
      admin,
      event(user.id, {
        type: "customer.subscription.deleted",
        status: "canceled",
        canceledAt: endedAt,
        currentPeriodEnd: endedAt,
      }),
    );
    const r = await row(user.id);
    expect(r.status).toBe("canceled");
    expect(Date.parse(r.canceled_at!)).toBe(Date.parse(endedAt));
    expect(await access(user.id)).toBe(false);
  });

  it("finds the user by customer id when metadata is missing", async () => {
    const user = await createUser(admin, "pay-bycustomer");
    const first = event(user.id, { occurredAt: new Date(Date.now() - 1000).toISOString() });
    await applySubscriptionEvent(admin, first);
    expect(
      await applySubscriptionEvent(admin, {
        ...event(user.id),
        userId: null,
        customerId: first.customerId,
        status: "past_due",
      }),
    ).toBe("applied");
    expect((await row(user.id)).status).toBe("past_due");
  });

  it("reports no_user when nobody matches", async () => {
    expect(
      await applySubscriptionEvent(admin, {
        ...event(crypto.randomUUID()),
        customerId: "cus_nobody",
        subscriptionId: "sub_nobody",
      }),
    ).toBe("no_user");
  });
});
