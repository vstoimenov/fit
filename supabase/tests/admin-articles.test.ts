import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/app-error";
import {
  articleInputSchema,
  deleteArticle,
  getArticle,
  listArticles,
  saveArticle,
  setPublished,
} from "@/server/admin/articles";
import {
  adminClient,
  createAdminUser,
  createUser,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const tag = `adm-${Math.random().toString(36).slice(2, 8)}`;
const createdIds: string[] = [];

const input = (name: string, over: Record<string, unknown> = {}) => ({
  title: `Статия ${name}`,
  slug: `${tag}-${name}`,
  excerpt: "",
  body: "# Здравей\n\nТекст",
  coverUrl: "",
  level: "",
  membersOnly: false,
  ...over,
});

async function create(name: string, over: Record<string, unknown> = {}) {
  const { id } = await saveArticle(boss, null, input(name, over));
  createdIds.push(id);
  return id;
}

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "adm-art")).db;
});

afterAll(async () => {
  if (createdIds.length) await admin.from("articles").delete().in("id", createdIds);
});

describe("articleInputSchema", () => {
  it("accepts the minimal article and the empty optional fields", () => {
    expect(articleInputSchema.safeParse(input("ok")).success).toBe(true);
  });

  it.each([
    ["empty title", { title: "  " }],
    ["bad slug", { slug: "Ab c" }],
    ["short slug", { slug: "ab" }],
    ["long excerpt", { excerpt: "a".repeat(301) }],
    ["empty body", { body: "" }],
    ["huge body", { body: "a".repeat(50_001) }],
    ["http cover", { coverUrl: "http://x.bg/a.jpg" }],
    ["script cover", { coverUrl: "javascript:alert(1)" }],
    ["unknown level", { level: "guru" }],
  ])("rejects %s", (_name, over) => {
    expect(articleInputSchema.safeParse(input("bad", over)).success).toBe(false);
  });

  it("accepts https and /photos/ covers and every level", () => {
    for (const coverUrl of ["https://x.bg/a.jpg", "/photos/a.jpg"]) {
      expect(articleInputSchema.safeParse(input("c", { coverUrl })).success).toBe(true);
    }
    for (const level of ["beginner", "advanced", "pro"]) {
      expect(articleInputSchema.safeParse(input("l", { level })).success).toBe(true);
    }
  });
});

describe("admin articles service", () => {
  it("creates, edits, publishes, unpublishes and deletes", async () => {
    const id = await create("flow", { excerpt: "Кратко", level: "advanced", membersOnly: true });
    let article = await getArticle(boss, id);
    expect(article).toMatchObject({
      id,
      slug: `${tag}-flow`,
      title: "Статия flow",
      excerpt: "Кратко",
      level: "advanced",
      membersOnly: true,
      coverUrl: null,
      publishedAt: null,
    });

    await saveArticle(
      boss,
      id,
      input("flow", { title: "Ново заглавие", level: "", coverUrl: "/photos/a.jpg" }),
    );
    article = await getArticle(boss, id);
    expect(article).toMatchObject({
      title: "Ново заглавие",
      level: null,
      coverUrl: "/photos/a.jpg",
    });

    await setPublished(boss, id, true);
    article = await getArticle(boss, id);
    expect(article?.publishedAt).not.toBeNull();
    expect(Math.abs(Date.now() - new Date(article!.publishedAt!).getTime())).toBeLessThan(60_000);

    await setPublished(boss, id, false);
    expect((await getArticle(boss, id))?.publishedAt).toBeNull();

    await deleteArticle(boss, id);
    expect(await getArticle(boss, id)).toBeNull();
  });

  it("lists drafts first, then published newest first, without the body", async () => {
    const draft = await create("l-draft");
    const older = await create("l-old");
    const newer = await create("l-new");
    await admin
      .from("articles")
      .update({ published_at: new Date(Date.now() - 2 * 86_400_000).toISOString() })
      .eq("id", older);
    await admin
      .from("articles")
      .update({ published_at: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", newer);
    const mine = (await listArticles(boss)).filter((a) => [draft, older, newer].includes(a.id));
    expect(mine.map((a) => a.id)).toEqual([draft, newer, older]);
    expect(mine[0]).toMatchObject({ title: "Статия l-draft", publishedAt: null });
    expect(mine[0]).not.toHaveProperty("body");
  });

  it("refuses a duplicate slug with a CONFLICT", async () => {
    await create("dup");
    const error = await saveArticle(boss, null, input("dup")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: "CONFLICT",
      userMessage: "Има статия с този адрес (slug).",
    });

    const other = await create("dup2");
    const edit = await saveArticle(boss, other, input("dup2", { slug: `${tag}-dup` })).catch(
      (e: unknown) => e,
    );
    expect(edit).toMatchObject({ code: "CONFLICT" });
  });

  it("reports a missing article", async () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    await expect(saveArticle(boss, missing, input("none"))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(setPublished(boss, missing, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteArticle(boss, missing)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses everything to a non-admin", async () => {
    const id = await create("guarded");
    const db = await signedInClient(await createUser(admin, "adm-art-member"));
    await expect(saveArticle(db, null, input("member"))).rejects.toThrow();
    await expect(saveArticle(db, id, input("guarded", { title: "hacked" }))).rejects.toThrow();
    await expect(setPublished(db, id, true)).rejects.toThrow();
    await expect(deleteArticle(db, id)).rejects.toThrow();
    const { data } = await admin
      .from("articles")
      .select("title, published_at")
      .eq("id", id)
      .single();
    expect(data).toEqual({ title: "Статия guarded", published_at: null });
  });
});
