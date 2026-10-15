import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAudit } from "@/server/admin/audit";
import { dashboardSchema, getDashboard } from "@/server/admin/dashboard";
import { getSettings, listPlans, savePlan, saveSetting } from "@/server/admin/settings";
import {
  adminClient,
  createAdminUser,
  createUser,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;
const planIds: string[] = [];

beforeAll(async () => {
  admin = adminClient();
  const created = await createAdminUser(admin, "set-admin");
  boss = created.db;
  bossId = created.user.id;
  await admin.from("profiles").update({ name: "Шефката" }).eq("id", bossId);
});

afterAll(async () => {
  // Subscriptions keep a null plan_id when their plan goes, so the test plans can simply be removed.
  if (planIds.length) await admin.from("plans").delete().in("id", planIds);
});

async function newPlan(name: string, input: Record<string, unknown> = {}) {
  await savePlan(boss, null, {
    name,
    interval: "month",
    priceCents: 2490,
    active: false,
    sort: 9,
    stripePriceId: "",
    ...input,
  });
  const plan = (await listPlans(boss)).find((p) => p.name === name)!;
  planIds.push(plan.id);
  return plan;
}

const rand = () => Math.random().toString(36).slice(2, 8);

describe("saveSetting", () => {
  it("saves a valid setting and rejects an invalid one without changing what is stored", async () => {
    await saveSetting(boss, "risk", { inactiveDays: 7, minCompletionPct: 40 });
    expect((await getSettings(boss)).risk).toEqual({ inactiveDays: 7, minCompletionPct: 40 });
    await expect(
      saveSetting(boss, "risk", { inactiveDays: 0, minCompletionPct: 40 }),
    ).rejects.toThrow();
    expect((await getSettings(boss)).risk).toEqual({ inactiveDays: 7, minCompletionPct: 40 });
    await admin.from("settings").delete().eq("key", "risk");
  });

  it("rejects a malformed tracking id with the Bulgarian message and stores nothing", async () => {
    await admin.from("settings").delete().eq("key", "tracking");
    await expect(
      saveSetting(boss, "tracking", {
        metaPixelId: "",
        ga4Id: "nope",
        gtmId: "",
        googleAdsId: "",
      }),
    ).rejects.toThrow(/G-XXXXXXX/);
    const { data } = await admin.from("settings").select("key").eq("key", "tracking");
    expect(data).toEqual([]);
  });

  it("refuses non-admins", async () => {
    const db = await signedInClient(await createUser(admin, "set-sneaky"));
    await admin.from("settings").delete().eq("key", "payment_provider");
    await expect(saveSetting(db, "payment_provider", { provider: "revolut" })).rejects.toThrow();
    const { data } = await admin.from("settings").select("key").eq("key", "payment_provider");
    expect(data).toEqual([]);
  });
});

describe("plans", () => {
  it("creates and edits a plan", async () => {
    const name = `План ${rand()}`;
    const created = await newPlan(name);
    expect(created).toMatchObject({ price_cents: 2490, active: false, interval: "month" });
    await savePlan(boss, created.id, {
      name,
      interval: "month",
      priceCents: 2990,
      active: false,
      sort: 9,
      stripePriceId: "",
    });
    expect((await listPlans(boss)).find((p) => p.id === created.id)?.price_cents).toBe(2990);
  });

  it.each([
    ["a zero price", { priceCents: 0 }],
    ["a fractional price", { priceCents: 12.5 }],
    ["a missing price", { priceCents: Number.NaN }],
    ["an empty name", { name: "   " }],
    ["an unknown interval", { interval: "week" }],
  ])("rejects %s and saves nothing", async (_label, bad) => {
    const name = `Лош ${rand()}`;
    await expect(
      savePlan(boss, null, {
        name,
        interval: "month",
        priceCents: 1000,
        active: false,
        sort: 1,
        stripePriceId: "",
        ...bad,
      }),
    ).rejects.toThrow();
    const { data } = await admin.from("plans").select("id").eq("name", name);
    expect(data).toEqual([]);
  });

  it("throws NOT_FOUND when editing a plan that does not exist", async () => {
    await expect(
      savePlan(boss, crypto.randomUUID(), {
        name: "Няма ме",
        interval: "month",
        priceCents: 100,
        active: false,
        sort: 0,
        stripePriceId: "",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", userMessage: "Планът не е намерен." });
  });

  it("locks price and interval once a Stripe price id is set", async () => {
    const name = `Stripe план ${rand()}`;
    const priceId = `price_T6${Date.now()}`;
    const base = { name, interval: "month", priceCents: 1990, active: false, sort: 50 };
    const plan = await newPlan(name, { priceCents: 1990, sort: 50, stripePriceId: "" });
    await savePlan(boss, plan.id, { ...base, stripePriceId: priceId });
    await expect(
      savePlan(boss, plan.id, { ...base, priceCents: 2490, stripePriceId: priceId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      savePlan(boss, plan.id, { ...base, interval: "year", stripePriceId: priceId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await savePlan(boss, plan.id, {
      ...base,
      name: `${name} (нов надпис)`,
      stripePriceId: priceId,
    });
    const { data } = await admin
      .from("plans")
      .select("name, price_cents, provider_price_ids")
      .eq("id", plan.id)
      .single();
    expect(data).toMatchObject({
      name: `${name} (нов надпис)`,
      price_cents: 1990,
      provider_price_ids: { stripe: priceId },
    });
  });

  it("clears the Stripe price id only while no subscription uses the plan", async () => {
    const name = `Stripe чист ${rand()}`;
    const priceId = `price_T6${Date.now()}`;
    const base = { name, interval: "month", priceCents: 1990, active: false, sort: 50 };
    const plan = await newPlan(name, { priceCents: 1990, sort: 50, stripePriceId: priceId });
    const subscriber = await createUser(admin, "plan-sub");
    await admin
      .from("subscriptions")
      .insert({ user_id: subscriber.id, plan_id: plan.id, provider: "stripe", status: "active" });
    await expect(savePlan(boss, plan.id, { ...base, stripePriceId: "" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      savePlan(boss, plan.id, { ...base, stripePriceId: `price_T6other${Date.now()}` }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await admin.from("subscriptions").delete().eq("user_id", subscriber.id);
    await savePlan(boss, plan.id, { ...base, stripePriceId: "" });
    const { data } = await admin
      .from("plans")
      .select("provider_price_ids")
      .eq("id", plan.id)
      .single();
    expect(data?.provider_price_ids).toEqual({});
  });

  it("rejects a malformed Stripe price id and saves nothing", async () => {
    const name = `Лош Stripe ${rand()}`;
    await expect(
      savePlan(boss, null, {
        name,
        interval: "month",
        priceCents: 100,
        active: false,
        sort: 1,
        stripePriceId: "prod_123",
      }),
    ).rejects.toThrow();
    const { data } = await admin.from("plans").select("id").eq("name", name);
    expect(data).toEqual([]);
  });

  it("lists inactive plans for the admin", async () => {
    const plan = await newPlan(`Скрит ${rand()}`);
    expect((await listPlans(boss)).some((p) => p.id === plan.id)).toBe(true);
  });

  it("refuses non-admins", async () => {
    const db = await signedInClient(await createUser(admin, "plan-sneaky"));
    const name = `Чужд ${rand()}`;
    await expect(
      savePlan(db, null, {
        name,
        interval: "month",
        priceCents: 100,
        active: true,
        sort: 0,
        stripePriceId: "",
      }),
    ).rejects.toThrow();
    const { data } = await admin.from("plans").select("id").eq("name", name);
    expect(data).toEqual([]);
  });
});

describe("audit trail", () => {
  it("shows who changed the plan, what changed, and that it is the same row", async () => {
    const name = `Одит ${rand()}`;
    const plan = await newPlan(name);
    await savePlan(boss, plan.id, {
      name,
      interval: "month",
      priceCents: 3190,
      active: false,
      sort: 9,
      stripePriceId: "",
    });
    const mine = (await listAudit(boss, { limit: 200 })).filter(
      (e) => e.targetType === "plans" && e.targetId === plan.id,
    );
    expect(mine.map((e) => e.action).sort()).toEqual(["insert", "update"]);
    expect(mine.every((e) => e.actorName === "Шефката")).toBe(true);
    const update = mine.find((e) => e.action === "update")!;
    expect(update.diff).toEqual({ price_cents: { from: 2490, to: 3190 } });
  });

  it("pages backwards by id without repeats", async () => {
    const first = await listAudit(boss, { limit: 3 });
    expect(first).toHaveLength(3);
    const next = await listAudit(boss, { limit: 3, beforeId: first.at(-1)!.id });
    expect(next.every((e) => e.id < first.at(-1)!.id)).toBe(true);
    expect(new Set([...first, ...next].map((e) => e.id)).size).toBe(first.length + next.length);
  });

  it("names a system change as 'система' and a deleted actor as a deleted user", async () => {
    const plan = await newPlan(`Система ${rand()}`);
    await admin.from("plans").update({ sort: 11 }).eq("id", plan.id);
    const ghost = crypto.randomUUID();
    const { data: row } = await admin
      .from("audit_log")
      .insert({ actor_id: ghost, action: "update", target_type: "plans", target_id: plan.id })
      .select("id")
      .single();
    const entries = (await listAudit(boss, { limit: 200 })).filter((e) => e.targetId === plan.id);
    expect(entries.find((e) => e.action === "update" && e.id !== row!.id)?.actorName).toBe(
      "система",
    );
    expect(entries.find((e) => e.id === row!.id)?.actorName).toBe("изтрит потребител");
  });

  it("is refused to non-admins", async () => {
    const db = await signedInClient(await createUser(admin, "audit-sneaky"));
    expect(await listAudit(db, { limit: 5 })).toEqual([]);
  });
});

describe("dashboard service", () => {
  // A window far in the future: nothing else lives there, so the numbers are exact.
  const start = Date.UTC(2100 + Math.floor(Math.random() * 6000), 0, 10);
  const now = new Date(start + 12 * 3_600_000);
  const at = (daysBefore: number) =>
    new Date(now.getTime() - daysBefore * 86_400_000).toISOString();
  const anonIds = [crypto.randomUUID(), crypto.randomUUID()];

  afterAll(async () => {
    await admin.from("visits").delete().in("anon_id", anonIds);
  });

  it("parses the payload into numbers and passes the own host through", async () => {
    const { error } = await admin.from("visits").insert([
      {
        anon_id: anonIds[0]!,
        path: "/",
        device: "mobile",
        created_at: at(1),
        utm: { utm_source: "Meta" },
      },
      { anon_id: anonIds[0]!, path: "/a", device: "mobile", created_at: at(0.9), utm: null },
      {
        anon_id: anonIds[1]!,
        path: "/",
        device: "desktop",
        created_at: at(2),
        referrer: "https://www.fit.example/start",
        utm: null,
      },
    ]);
    expect(error).toBeNull();

    const own = await getDashboard(boss, now, "fit.example");
    expect(own.visits).toEqual({ today: 0, d7: 3, d30: 3, unique_d30: 2 });
    expect(own.sources).toEqual([
      { source: "direct", visitors: 1 },
      { source: "meta", visitors: 1 },
    ]);
    expect(own.funnel.visitors).toBe(2);
    expect(dashboardSchema.safeParse(own).success).toBe(true);

    const foreign = await getDashboard(boss, now);
    expect(foreign.sources.map((s) => s.source).sort()).toEqual(["fit.example", "meta"]);
  });

  it("counts a paid subscription in MRR (yearly spread over 12 months) but not a manual one", async () => {
    const before = (await getDashboard(boss)).subscriptions;
    const plan = await newPlan(`MRR ${rand()}`, { interval: "year", priceCents: 12000 });
    const paid = await createUser(admin, "dash-paid");
    const comped = await createUser(admin, "dash-manual");
    await admin
      .from("subscriptions")
      .insert({ user_id: paid.id, plan_id: plan.id, provider: "stripe", status: "active" });
    await admin
      .from("subscriptions")
      .insert({ user_id: comped.id, plan_id: plan.id, provider: "manual", status: "active" });
    const after = (await getDashboard(boss)).subscriptions;
    expect(after.mrr_cents - before.mrr_cents).toBe(1000);
    expect(after.active - before.active).toBe(1);
    await admin.from("subscriptions").delete().in("user_id", [paid.id, comped.id]);
  });

  it("refuses non-admins", async () => {
    const db = await signedInClient(await createUser(admin, "dash-sneaky"));
    await expect(getDashboard(db)).rejects.toThrow();
  });
});
