import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NormalizedSubscriptionEvent } from "@/lib/payments/types";
import {
  applySubscriptionEvent,
  markPaymentEvent,
  recordPaymentEvent,
} from "@/server/payments/apply-event";
import {
  adminClient,
  anonClient,
  createAdminUser,
  createUser,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let planId: string;
let priceId: string;
const day = 86_400_000;

// Own plan with a unique price id: the database also holds monthly plans left by other tests.
beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "apply-admin")).db;
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
        currentPeriodEnd: new Date(Date.now() + 20 * day).toISOString(),
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
  it("ends access at once on an immediate cancel even if the paid period had days left", async () => {
    const user = await createUser(admin, "pay-immediate");
    await applySubscriptionEvent(
      admin,
      event(user.id, { occurredAt: new Date(Date.now() - 2000).toISOString() }),
    );
    expect(await access(user.id)).toBe(true);
    const now = new Date().toISOString();
    await applySubscriptionEvent(
      admin,
      event(user.id, {
        type: "customer.subscription.deleted",
        status: "canceled",
        canceledAt: now,
        currentPeriodEnd: new Date(Date.now() + 20 * day).toISOString(),
      }),
    );
    expect(await access(user.id)).toBe(false);
    expect(Date.parse((await row(user.id)).current_period_end!)).toBe(Date.parse(now));
  });

  it("lets the newer of two concurrent events win, whatever order they arrive in", async () => {
    for (let round = 0; round < 12; round++) {
      const user = await createUser(admin, `pay-race-${round}`);
      // Odd rounds start from an existing row (update path), even rounds from none (insert path).
      if (round % 2 === 1) {
        await applySubscriptionEvent(
          admin,
          event(user.id, { occurredAt: new Date(Date.now() - 120_000).toISOString() }),
        );
      }
      const older = event(user.id, {
        status: "active",
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
      });
      const newerAt = new Date(Date.now() - 30_000).toISOString();
      const newer = event(user.id, { status: "past_due", occurredAt: newerAt });
      const pair = round % 4 < 2 ? [older, newer] : [newer, older];
      const results = await Promise.all(pair.map((ev) => applySubscriptionEvent(admin, ev)));
      expect(results).toContain("applied");
      const r = await row(user.id);
      expect(r.status).toBe("past_due");
      expect(Date.parse(r.provider_event_at!)).toBe(Date.parse(newerAt));
    }
  });

  it("applies events with the same timestamp in arrival order (ties apply)", async () => {
    // Task 4 re-fetches the subscription from the provider before trusting a same-second event.
    const user = await createUser(admin, "pay-tie");
    const at = new Date(Date.now() - 5000).toISOString();
    expect(
      await applySubscriptionEvent(admin, event(user.id, { status: "past_due", occurredAt: at })),
    ).toBe("applied");
    expect(
      await applySubscriptionEvent(admin, event(user.id, { status: "active", occurredAt: at })),
    ).toBe("applied");
    expect((await row(user.id)).status).toBe("active");
  });

  it("ignores the end of a second subscription but lets a live one replace the first", async () => {
    const user = await createUser(admin, "pay-double");
    const subA = `sub_A_${crypto.randomUUID()}`;
    const subB = `sub_B_${crypto.randomUUID()}`;
    await applySubscriptionEvent(
      admin,
      event(user.id, {
        subscriptionId: subA,
        occurredAt: new Date(Date.now() - 3000).toISOString(),
      }),
    );
    expect(
      await applySubscriptionEvent(
        admin,
        event(user.id, {
          subscriptionId: subB,
          type: "customer.subscription.deleted",
          status: "canceled",
          canceledAt: new Date().toISOString(),
          occurredAt: new Date(Date.now() - 2000).toISOString(),
        }),
      ),
    ).toBe("ignored");
    expect(await row(user.id)).toMatchObject({ provider_sub_id: subA, status: "active" });
    expect(await access(user.id)).toBe(true);
    expect(
      await applySubscriptionEvent(
        admin,
        event(user.id, {
          subscriptionId: subB,
          occurredAt: new Date(Date.now() - 1000).toISOString(),
        }),
      ),
    ).toBe("applied");
    expect(await row(user.id)).toMatchObject({ provider_sub_id: subB, status: "active" });
  });

  it("does not let the old subscription's end wipe a manual grant made after dunning", async () => {
    const user = await createUser(admin, "pay-dunned");
    const oldSub = `sub_old_${crypto.randomUUID()}`;
    const { error } = await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "stripe",
      status: "past_due",
      provider_sub_id: oldSub,
      provider_customer_id: `cus_${user.id.slice(0, 8)}`,
      current_period_end: new Date(Date.now() - 5 * day).toISOString(),
      grace_until: new Date(Date.now() - day).toISOString(),
      provider_event_at: new Date(Date.now() - 10 * day).toISOString(),
    });
    expect(error).toBeNull();
    expect(await access(user.id)).toBe(false);
    expect(
      (await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 30 })).error,
    ).toBeNull();
    expect(await access(user.id)).toBe(true);
    expect(
      await applySubscriptionEvent(
        admin,
        event(user.id, {
          subscriptionId: oldSub,
          type: "customer.subscription.deleted",
          status: "canceled",
          canceledAt: new Date().toISOString(),
        }),
      ),
    ).toBe("ignored");
    expect(await row(user.id)).toMatchObject({ provider: "manual", status: "active" });
    expect(await access(user.id)).toBe(true);
  });

  it("cannot be executed by clients or anonymous callers", async () => {
    const user = await createUser(admin, "pay-exec");
    const now = new Date().toISOString();
    const args = {
      p_user_id: user.id,
      p_provider: "stripe" as const,
      p_customer_id: "cus_x",
      p_sub_id: "sub_x",
      p_status: "active" as const,
      p_period_end: now,
      p_cancel_at_period_end: false,
      p_canceled_at: now,
      p_plan_id: planId,
      p_price_cents: 1990,
      p_interval: "month" as const,
      p_event_at: now,
    };
    const asUser = await signedInClient(user);
    expect((await asUser.rpc("apply_subscription_event", args)).error?.code).toBe("42501");
    expect((await anonClient().rpc("apply_subscription_event", args)).error?.code).toBe("42501");
    expect(
      (await admin.from("subscriptions").select("user_id").eq("user_id", user.id)).data,
    ).toEqual([]);
  });
});
