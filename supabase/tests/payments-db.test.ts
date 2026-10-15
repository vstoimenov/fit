import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "pay-admin")).db;
});

describe("payment_events", () => {
  it("is unique per provider event and hidden from clients", async () => {
    const eventId = `evt_${crypto.randomUUID()}`;
    const first = await admin
      .from("payment_events")
      .insert({ provider: "stripe", event_id: eventId, type: "x", payload: {} });
    expect(first.error).toBeNull();
    const dup = await admin
      .from("payment_events")
      .insert({ provider: "stripe", event_id: eventId, type: "x", payload: {} });
    expect(dup.error?.code).toBe("23505");
    const client = await signedInClient(await createUser(admin, "pay-client"));
    const { data, error } = await client
      .from("payment_events")
      .select("id")
      .eq("event_id", eventId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const write = await client.from("payment_events").insert({
      provider: "stripe",
      event_id: `evt_${crypto.randomUUID()}`,
      type: "x",
      payload: {},
    });
    expect(write.error?.code).toBe("42501");
    const { data: seen } = await boss.from("payment_events").select("id").eq("event_id", eventId);
    expect(seen).toHaveLength(1);
  });

  it("survives deleting the user it mentions", async () => {
    const user = await createUser(admin, "pay-del");
    const eventId = `evt_${crypto.randomUUID()}`;
    await admin
      .from("payment_events")
      .insert({ provider: "stripe", event_id: eventId, type: "x", user_id: user.id, payload: {} });
    await admin.auth.admin.deleteUser(user.id);
    const { data } = await admin
      .from("payment_events")
      .select("user_id")
      .eq("event_id", eventId)
      .single();
    expect(data?.user_id).toBe(user.id);
  });
});

describe("active_payment_provider", () => {
  it("defaults to stripe and follows the admin setting", async () => {
    const client = await signedInClient(await createUser(admin, "pay-prov"));
    await boss.from("settings").delete().eq("key", "payment_provider");
    expect((await client.rpc("active_payment_provider")).data).toBe("stripe");
    await boss.from("settings").upsert({ key: "payment_provider", value: { provider: "revolut" } });
    expect((await client.rpc("active_payment_provider")).data).toBe("revolut");
    await boss.from("settings").delete().eq("key", "payment_provider");
  });

  it("falls back to stripe when the stored value is not a known provider", async () => {
    const client = await signedInClient(await createUser(admin, "pay-prov-bad"));
    try {
      for (const bad of ["paypal", "", "STRIPE"]) {
        await boss.from("settings").upsert({ key: "payment_provider", value: { provider: bad } });
        expect((await client.rpc("active_payment_provider")).data).toBe("stripe");
      }
      await boss
        .from("settings")
        .upsert({ key: "payment_provider", value: { provider: "revolut" } });
      expect((await client.rpc("active_payment_provider")).data).toBe("revolut");
    } finally {
      await boss.from("settings").delete().eq("key", "payment_provider");
    }
  });
});

describe("admin_grant_manual", () => {
  async function sub(userId: string) {
    const { data } = await admin
      .from("subscriptions")
      .select("provider, status, current_period_end")
      .eq("user_id", userId)
      .single();
    return data!;
  }

  it("creates and extends a manual grant", async () => {
    const user = await createUser(admin, "grant-new");
    const first = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 10 });
    expect(first.error).toBeNull();
    const second = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 10 });
    expect(Date.parse(second.data as string) - Date.now()).toBeGreaterThan(19 * day);
    expect((await sub(user.id)).provider).toBe("manual");
  });

  it("replaces a non-live paid row (former customer)", async () => {
    const user = await createUser(admin, "grant-former");
    await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "stripe",
      status: "canceled",
      current_period_end: iso(-day),
    });
    const { error } = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 7 });
    expect(error).toBeNull();
    expect(await sub(user.id)).toMatchObject({ provider: "manual", status: "active" });
  });

  it("refuses while a paid subscription is live and refuses non-admins", async () => {
    const user = await createUser(admin, "grant-live");
    await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "stripe",
      status: "active",
      current_period_end: iso(10 * day),
    });
    const refused = await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 7 });
    expect(refused.error?.code).toBe("23P01");
    expect((await sub(user.id)).provider).toBe("stripe");
    const half = await createAal1Admin(admin, "grant-half");
    const denied = await half.db.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 7 });
    expect(denied.error?.code).toBe("42501");
  });

  it("never overwrites a paid subscription that is inserted at the same moment", async () => {
    // Users without any row: the grant's existence check sees nothing, so only the guard on the
    // insert-or-update itself can protect a paid row that lands in between. Whatever the
    // interleaving, the paid row must win.
    const users = await Promise.all(
      Array.from({ length: 12 }, (_, i) => createUser(admin, `grant-race-${i}`)),
    );
    const results = await Promise.all(
      users.flatMap((u) => [
        boss.rpc("admin_grant_manual", { p_user_id: u.id, p_days: 7 }),
        admin.from("subscriptions").upsert(
          {
            user_id: u.id,
            provider: "stripe",
            status: "active",
            current_period_end: iso(10 * day),
          },
          { onConflict: "user_id" },
        ),
      ]),
    );
    for (const r of results) {
      if (r.error) expect(r.error.code).toBe("23P01");
    }
    for (const u of users) expect((await sub(u.id)).provider).toBe("stripe");
  });

  it("rejects absurd day counts", async () => {
    const user = await createUser(admin, "grant-days");
    expect(
      (await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 0 })).error?.code,
    ).toBe("22023");
    expect(
      (await boss.rpc("admin_grant_manual", { p_user_id: user.id, p_days: 400 })).error?.code,
    ).toBe("22023");
  });
});

describe("dashboard MRR uses the paid price snapshot", () => {
  const mrr = async () =>
    ((await boss.rpc("admin_dashboard", {})).data as { subscriptions: { mrr_cents: number } })
      .subscriptions.mrr_cents;

  // Own plan so the test does not depend on (or collide with) whatever plans other tests leave behind.
  async function monthlyPlan(priceCents: number) {
    const { data, error } = await admin
      .from("plans")
      .insert({
        name: `mrr-${crypto.randomUUID().slice(0, 8)}`,
        interval: "month",
        price_cents: priceCents,
        active: false,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  it("counts the snapshot, not the current plan price", async () => {
    const planId = await monthlyPlan(1990);
    try {
      const before = await mrr();
      const user = await createUser(admin, "mrr-snap");
      await admin.from("subscriptions").insert({
        user_id: user.id,
        provider: "stripe",
        status: "active",
        plan_id: planId,
        price_cents: 1500,
        billing_interval: "month",
      });
      expect((await mrr()) - before).toBe(1500);
    } finally {
      await admin.from("plans").delete().eq("id", planId);
    }
  });

  it("falls back to the plan price when there is no snapshot", async () => {
    const planId = await monthlyPlan(777);
    try {
      const before = await mrr();
      const user = await createUser(admin, "mrr-nosnap");
      await admin.from("subscriptions").insert({
        user_id: user.id,
        provider: "stripe",
        status: "active",
        plan_id: planId,
      });
      expect((await mrr()) - before).toBe(777);
    } finally {
      await admin.from("plans").delete().eq("id", planId);
    }
  });
});
