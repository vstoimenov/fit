import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSettings, saveSetting } from "@/server/admin/settings";
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
const rand = () => Math.random().toString(36).slice(2, 8);
const day = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const tag = `art-${rand()}`;
const createdIds: string[] = [];

async function insertArticle(db: TypedClient, name: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await db
    .from("articles")
    .insert({
      slug: `${tag}-${name}`,
      title: `Статия ${name}`,
      body: "Текст",
      ...fields,
    })
    .select("id, slug")
    .single();
  if (error || !data) throw error ?? new Error("insert article failed");
  createdIds.push(data.id);
  return data;
}

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "art-admin")).db;
});

afterAll(async () => {
  if (createdIds.length) await admin.from("articles").delete().in("id", createdIds);
  await admin.from("settings").delete().eq("key", "community_url");
});

describe("articles cover_url CHECK", () => {
  it("accepts a plain local or https cover and refuses a query string, fragment or whitespace", async () => {
    await insertArticle(boss, "cover-ok", { cover_url: "/photos/a.jpg" });
    await insertArticle(boss, "cover-https", { cover_url: "https://x.bg/a.jpg?v=1" });
    for (const [i, bad] of [
      "/photos/a.jpg?v=1",
      "/photos/a.jpg#x",
      "/photos/a b.jpg",
      "https://x y",
    ].entries()) {
      const { error } = await boss
        .from("articles")
        .insert({ slug: `${tag}-cover-bad-${i}`, title: "x", body: "x", cover_url: bad });
      expect(error?.code, bad).toBe("23514");
    }
  });
});

describe("articles RLS", () => {
  it("shows a member only published, non-members-only articles until she has access", async () => {
    const draft = await insertArticle(boss, "draft");
    const published = await insertArticle(boss, "pub", { published_at: iso(-day) });
    const future = await insertArticle(boss, "future", { published_at: iso(day) });
    const gated = await insertArticle(boss, "gated", {
      published_at: iso(-day),
      members_only: true,
    });
    const ids = [draft.id, published.id, future.id, gated.id];

    const user = await createUser(admin, "art-member");
    const db = await signedInClient(user);
    const visible = async (client: TypedClient) => {
      const { data, error } = await client.from("articles").select("id").in("id", ids);
      expect(error).toBeNull();
      return (data ?? []).map((r) => r.id).sort();
    };
    expect(await visible(db)).toEqual([published.id]);

    await grantAccess(admin, user.id);
    expect(await visible(db)).toEqual([published.id, gated.id].sort());

    expect(await visible(boss)).toEqual([...ids].sort());
  });

  it("refuses member insert, update and delete", async () => {
    const row = await insertArticle(boss, "ro", { published_at: iso(-day) });
    const user = await createUser(admin, "art-ro");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);

    const ins = await db
      .from("articles")
      .insert({ slug: `${tag}-member`, title: "x", body: "x" })
      .select("id");
    expect(ins.error).not.toBeNull();

    const upd = await db.from("articles").update({ title: "hacked" }).eq("id", row.id).select("id");
    expect(upd.data ?? []).toEqual([]);

    const del = await db.from("articles").delete().eq("id", row.id).select("id");
    expect(del.data ?? []).toEqual([]);

    const { data } = await admin.from("articles").select("title").eq("id", row.id).single();
    expect(data?.title).toBe("Статия ro");
  });

  it("has no access for anon", async () => {
    const { data, error } = await anonClient().from("articles").select("id").limit(1);
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe("articles CHECK constraints", () => {
  it("rejects a bad slug and an oversized body", async () => {
    const badSlug = await boss.from("articles").insert({ slug: "Ab", title: "x", body: "x" });
    expect(badSlug.error).not.toBeNull();
    const longBody = await boss
      .from("articles")
      .insert({ slug: `${tag}-long`, title: "x", body: "a".repeat(50_001) });
    expect(longBody.error).not.toBeNull();
    const ok = await boss
      .from("articles")
      .insert({ slug: `${tag}-max`, title: "x", body: "a".repeat(50_000) })
      .select("id")
      .single();
    expect(ok.error).toBeNull();
    if (ok.data) createdIds.push(ok.data.id);
  });

  it("rejects an unsafe cover url", async () => {
    const bad = await boss
      .from("articles")
      .insert({ slug: `${tag}-cover`, title: "x", body: "x", cover_url: "javascript:alert(1)" });
    expect(bad.error).not.toBeNull();
  });
});

describe("community_link()", () => {
  const link = async (db: TypedClient) => {
    const { data, error } = await db.rpc("community_link");
    expect(error).toBeNull();
    return data;
  };

  it("is null by default, for empty and for non-https values, and returns an https url", async () => {
    const user = await createUser(admin, "art-link");
    const db = await signedInClient(user);

    await admin.from("settings").delete().eq("key", "community_url");
    expect(await link(db)).toBeNull();

    await admin.from("settings").upsert({ key: "community_url", value: "" });
    expect(await link(db)).toBeNull();
    await admin.from("settings").upsert({ key: "community_url", value: "   " });
    expect(await link(db)).toBeNull();
    await admin.from("settings").upsert({ key: "community_url", value: "http://x" });
    expect(await link(db)).toBeNull();
    await admin.from("settings").upsert({ key: "community_url", value: 42 });
    expect(await link(db)).toBeNull();
    await admin
      .from("settings")
      .upsert({ key: "community_url", value: { url: "https://t.me/grupa" } });
    expect(await link(db)).toBeNull();

    await admin.from("settings").upsert({ key: "community_url", value: "https://t.me/grupa" });
    expect(await link(db)).toBe("https://t.me/grupa");
    await admin.from("settings").upsert({ key: "community_url", value: "  https://t.me/grupa " });
    expect(await link(db)).toBe("https://t.me/grupa");
  });

  it("is not callable by anon", async () => {
    const { error } = await anonClient().rpc("community_link");
    expect(error).not.toBeNull();
  });
});

describe("community_url setting", () => {
  it("refuses a non-https url and round-trips an https one", async () => {
    await admin.from("settings").delete().eq("key", "community_url");
    await expect(saveSetting(boss, "community_url", "http://x")).rejects.toThrow();
    const { data } = await admin.from("settings").select("key").eq("key", "community_url");
    expect(data).toEqual([]);
    expect((await getSettings(boss)).community_url).toBe("");

    await saveSetting(boss, "community_url", "https://t.me/grupa");
    expect((await getSettings(boss)).community_url).toBe("https://t.me/grupa");
    await saveSetting(boss, "community_url", "");
    expect((await getSettings(boss)).community_url).toBe("");
    await expect(
      saveSetting(boss, "community_url", `https://x.bg/${"a".repeat(300)}`),
    ).rejects.toThrow();
  });
});
