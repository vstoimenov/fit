import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PaymentProvider } from "@/server/payments/provider";
import { openPortal, startCheckout } from "@/server/payments/checkout";
import { adminClient, createUser, grantAccess, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;
let priced: { id: string; priceId: string };
let unpricedId: string;
let inactiveId: string;
const planIds: string[] = [];

/** Own plans with unique price ids: other tests leave extra plans in the shared database. */
async function createPlan(fields: {
  provider_price_ids: Record<string, string>;
  active?: boolean;
}) {
  const { data, error } = await admin
    .from("plans")
    .insert({ name: "Checkout test", interval: "month", price_cents: 1234, ...fields })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("createPlan failed");
  planIds.push(data.id);
  return data.id;
}

beforeAll(async () => {
  admin = adminClient();
  const priceId = `price_test_${crypto.randomUUID()}`;
  priced = { id: await createPlan({ provider_price_ids: { stripe: priceId } }), priceId };
  unpricedId = await createPlan({ provider_price_ids: {} });
  inactiveId = await createPlan({
    provider_price_ids: { stripe: `price_test_${crypto.randomUUID()}` },
    active: false,
  });
});

afterAll(async () => {
  await admin.from("plans").delete().in("id", planIds);
});

function fakeProvider(): PaymentProvider & {
  createCheckout: ReturnType<typeof vi.fn>;
  createPortal: ReturnType<typeof vi.fn>;
} {
  return {
    name: "stripe",
    ready: true,
    createCheckout: vi.fn(async () => ({ url: "https://pay.example/1" })),
    createPortal: vi.fn(async () => ({ url: "https://portal.example/1" })),
    cancelNow: vi.fn(),
    parseWebhook: vi.fn(),
  } as never;
}

describe("startCheckout", () => {
  it("sends the plan's price, success/cancel urls and the user", async () => {
    const user = await createUser(admin, "co-new");
    const p = fakeProvider();
    const { url } = await startCheckout(await signedInClient(user), p, {
      userId: user.id,
      email: user.email,
      planId: priced.id,
      appUrl: "http://localhost:3120",
    });
    expect(url).toBe("https://pay.example/1");
    expect(p.createCheckout).toHaveBeenCalledWith({
      userId: user.id,
      email: user.email,
      customerId: null,
      priceId: priced.priceId,
      successUrl: "http://localhost:3120/app/welcome?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "http://localhost:3120/app/plan",
    });
  });

  it("refuses a user who already has access", async () => {
    const user = await createUser(admin, "co-has");
    await grantAccess(admin, user.id);
    const p = fakeProvider();
    await expect(
      startCheckout(await signedInClient(user), p, {
        userId: user.id,
        email: user.email,
        planId: priced.id,
        appUrl: "x",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(p.createCheckout).not.toHaveBeenCalled();
  });

  it("refuses an inactive plan, an unknown plan and a plan without a price id", async () => {
    const user = await createUser(admin, "co-plan");
    const db = await signedInClient(user);
    const input = { userId: user.id, email: user.email, appUrl: "x" };
    await expect(
      startCheckout(db, fakeProvider(), { ...input, planId: unpricedId }),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(
      startCheckout(db, fakeProvider(), { ...input, planId: inactiveId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      startCheckout(db, fakeProvider(), { ...input, planId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reuses the stored customer of a former subscriber", async () => {
    const user = await createUser(admin, "co-former");
    await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "stripe",
      status: "canceled",
      provider_customer_id: "cus_old",
      current_period_end: new Date(Date.now() - 1000).toISOString(),
    });
    const p = fakeProvider();
    await startCheckout(await signedInClient(user), p, {
      userId: user.id,
      email: user.email,
      planId: priced.id,
      appUrl: "x",
    });
    expect(p.createCheckout.mock.calls[0]![0]).toMatchObject({ customerId: "cus_old" });
  });

  it("ignores a customer id that belongs to another provider", async () => {
    const user = await createUser(admin, "co-other");
    await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "revolut",
      status: "canceled",
      provider_customer_id: "rev_cus",
      current_period_end: new Date(Date.now() - 1000).toISOString(),
    });
    const p = fakeProvider();
    await startCheckout(await signedInClient(user), p, {
      userId: user.id,
      email: user.email,
      planId: priced.id,
      appUrl: "x",
    });
    expect(p.createCheckout.mock.calls[0]![0]).toMatchObject({ customerId: null });
  });
});

describe("openPortal", () => {
  it("opens the portal for a customer and refuses without one", async () => {
    const user = await createUser(admin, "co-portal");
    const p = fakeProvider();
    await expect(
      openPortal(await signedInClient(user), p, { userId: user.id, appUrl: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "stripe",
      status: "active",
      provider_customer_id: "cus_p",
    });
    await openPortal(await signedInClient(user), p, {
      userId: user.id,
      appUrl: "http://localhost:3120",
    });
    expect(p.createPortal).toHaveBeenCalledWith({
      customerId: "cus_p",
      returnUrl: "http://localhost:3120/app/profile",
    });
  });
});
