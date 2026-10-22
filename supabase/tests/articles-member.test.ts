import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getArticleBySlug, getCommunityLink, listArticlesFor } from "@/server/content/articles";
import {
  adminClient,
  createAdminUser,
  createUser,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const rand = () => Math.random().toString(36).slice(2, 8);
const day = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const tag = `mem-${rand()}`;
const createdIds: string[] = [];

async function insertArticle(name: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await boss
    .from("articles")
    .insert({ slug: `${tag}-${name}`, title: `Статия ${name}`, body: "Текст", ...fields })
    .select("id, slug")
    .single();
  if (error || !data) throw error ?? new Error("insert article failed");
  createdIds.push(data.id);
  return data;
}

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "mem-admin")).db;
});

afterAll(async () => {
  if (createdIds.length) await admin.from("articles").delete().in("id", createdIds);
  await admin.from("settings").delete().eq("key", "community_url");
});

describe("listArticlesFor", () => {
  it("returns null-level and own-level published articles, newest first, never other levels or drafts", async () => {
    const all = await insertArticle("all", { published_at: iso(-3 * day) });
    const beginner = await insertArticle("beg", { published_at: iso(-day), level: "beginner" });
    const advanced = await insertArticle("adv", { published_at: iso(-2 * day), level: "advanced" });
    const draft = await insertArticle("draft");

    const db = await signedInClient(await createUser(admin, "mem-beginner"));
    const rows = await listArticlesFor(db, "beginner");
    const mine = rows.filter((r) => r.slug.startsWith(tag));
    expect(mine.map((r) => r.id)).toEqual([beginner.id, all.id]);
    expect(mine.map((r) => r.id)).not.toContain(advanced.id);
    expect(mine.map((r) => r.id)).not.toContain(draft.id);
    expect(Object.keys(mine[0]).sort()).toEqual(
      ["cover_url", "excerpt", "id", "level", "published_at", "slug", "title"].sort(),
    );
  });
});

describe("listArticlesFor limit", () => {
  it("returns only the newest article when asked for one", async () => {
    const older = await insertArticle("lim-old", { published_at: iso(-5 * day) });
    const newest = await insertArticle("lim-new", { published_at: iso(-1) });
    const db = await signedInClient(await createUser(admin, "mem-limit"));
    const rows = await listArticlesFor(db, "beginner", 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(newest.id);
    expect(rows[0].id).not.toBe(older.id);
  });
});

describe("getArticleBySlug", () => {
  it("returns the full row for a published article and null for a draft or unknown slug", async () => {
    const pub = await insertArticle("pub", { published_at: iso(-day), body: "## Здравей" });
    const draft = await insertArticle("draft2");
    const db = await signedInClient(await createUser(admin, "mem-reader"));

    expect((await getArticleBySlug(db, pub.slug))?.body).toBe("## Здравей");
    expect(await getArticleBySlug(db, draft.slug)).toBeNull();
    expect(await getArticleBySlug(db, `${tag}-missing`)).toBeNull();
  });

  it("returns null for a members-only article without access", async () => {
    const gated = await insertArticle("gated", { published_at: iso(-day), members_only: true });
    const db = await signedInClient(await createUser(admin, "mem-free"));
    expect(await getArticleBySlug(db, gated.slug)).toBeNull();
  });
});

describe("getCommunityLink", () => {
  it("is null without a setting and the url once set", async () => {
    const db = await signedInClient(await createUser(admin, "mem-link"));
    await admin.from("settings").delete().eq("key", "community_url");
    expect(await getCommunityLink(db)).toBeNull();
    const { error } = await admin
      .from("settings")
      .upsert({ key: "community_url", value: "https://example.com/group" });
    expect(error).toBeNull();
    expect(await getCommunityLink(db)).toBe("https://example.com/group");
  });
});
