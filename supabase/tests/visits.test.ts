import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { recordVisit } from "@/server/visits/record-visit";
import { adminClient, createUser, type TypedClient } from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("recordVisit", () => {
  it("inserts a row with the given fields", async () => {
    const anonId = randomUUID();
    await recordVisit(admin, {
      anonId,
      userId: null,
      path: "/login",
      referrer: "https://example.test/",
      utm: { utm_source: "meta", utm_campaign: "test" },
      device: "mobile",
    });
    const { data, error } = await admin.from("visits").select("*").eq("anon_id", anonId).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      anon_id: anonId,
      user_id: null,
      path: "/login",
      referrer: "https://example.test/",
      utm: { utm_source: "meta", utm_campaign: "test" },
      device: "mobile",
    });
  });

  it("stores null referrer and null utm for empty values", async () => {
    const anonId = randomUUID();
    await recordVisit(admin, {
      anonId,
      userId: null,
      path: "/",
      referrer: "",
      utm: {},
      device: "desktop",
    });
    const { data } = await admin
      .from("visits")
      .select("referrer, utm")
      .eq("anon_id", anonId)
      .single();
    expect(data).toEqual({ referrer: null, utm: null });
  });

  it("updates last_seen_at for a signed-in user", async () => {
    const user = await createUser(admin, "visitor");
    const before = await admin.from("profiles").select("last_seen_at").eq("id", user.id).single();
    await recordVisit(admin, {
      anonId: randomUUID(),
      userId: user.id,
      path: "/app",
      referrer: "",
      device: "tablet",
    });
    const after = await admin.from("profiles").select("last_seen_at").eq("id", user.id).single();
    expect(after.data?.last_seen_at).not.toBeNull();
    expect(after.data?.last_seen_at).not.toBe(before.data?.last_seen_at);
    const visit = await admin.from("visits").select("user_id").eq("user_id", user.id);
    expect(visit.data).toHaveLength(1);
  });

  it("does not rewrite last_seen_at within 5 minutes, but does once it is stale", async () => {
    const user = await createUser(admin, "throttle");
    const visit = () =>
      recordVisit(admin, {
        anonId: randomUUID(),
        userId: user.id,
        path: "/app",
        referrer: "",
        device: "mobile",
      });
    const seenAt = async () =>
      (await admin.from("profiles").select("last_seen_at").eq("id", user.id).single()).data
        ?.last_seen_at;

    await visit();
    const first = await seenAt();
    expect(first).not.toBeNull();

    await visit();
    expect(await seenAt()).toBe(first);

    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await admin.from("profiles").update({ last_seen_at: stale }).eq("id", user.id);
    await visit();
    const refreshed = await seenAt();
    expect(refreshed).not.toBe(stale);
    expect(new Date(refreshed!).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("rejects an invalid device", async () => {
    await expect(
      recordVisit(admin, {
        anonId: randomUUID(),
        userId: null,
        path: "/",
        referrer: "",
        device: "toaster" as unknown as "mobile",
      }),
    ).rejects.toThrow(/^record visit failed \(code \w+\)$/);
  });
});
