import { describe, expect, it } from "vitest";
import { adminClient, createAdminUser, createUser, grantAccess, signedInClient } from "./helpers";

async function session(startsAt: Date, published = true, durationMin = 60) {
  const admin = adminClient();
  const { db } = await createAdminUser(admin, "live-admin");
  const { data, error } = await db
    .from("live_sessions")
    .insert({
      title: "Тест на живо",
      starts_at: startsAt.toISOString(),
      duration_min: durationMin,
      join_url: "https://zoom.us/j/123",
      published,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { admin, id: data.id };
}

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

describe("live sessions", () => {
  it("members with access see published sessions; others see nothing", async () => {
    const { admin, id } = await session(minutes(60));
    const { id: draft } = await session(minutes(60), false);
    const member = await createUser(admin, "live-member");
    await grantAccess(admin, member.id);
    const db = await signedInClient(member);
    const ids = (await db.from("live_sessions").select("id")).data?.map((r) => r.id) ?? [];
    expect(ids).toContain(id);
    expect(ids).not.toContain(draft);
    const visitor = await signedInClient(await createUser(admin, "live-visitor"));
    expect((await visitor.from("live_sessions").select("id")).data).toEqual([]);
    // A member's write is a silent no-op under RLS.
    await db.from("live_sessions").update({ title: "x" }).eq("id", id);
    const { data: still } = await admin.from("live_sessions").select("title").eq("id", id).single();
    expect(still?.title).toBe("Тест на живо");
  });

  it("„Влизам“ in the window records attendance and 5 points once", async () => {
    const { admin, id } = await session(minutes(5));
    const member = await createUser(admin, "live-attend");
    await grantAccess(admin, member.id);
    const db = await signedInClient(member);
    expect((await db.rpc("attend_live", { p_session_id: id })).error).toBeNull();
    expect((await db.rpc("attend_live", { p_session_id: id })).error).toBeNull();
    const { data: points } = await admin
      .from("points_ledger")
      .select("points, source, ref")
      .eq("user_id", member.id)
      .eq("source", "live");
    expect(points).toEqual([{ points: 5, source: "live", ref: id }]);
    const { data: rows } = await db.from("live_attendance").select("session_id");
    expect(rows).toEqual([{ session_id: id }]);
  });

  it("refuses too early, too late, without access, and for drafts", async () => {
    const { admin, id: early } = await session(minutes(30));
    const { id: late } = await session(minutes(-90), true, 60);
    const { id: draft } = await session(minutes(5), false);
    const member = await createUser(admin, "live-early");
    await grantAccess(admin, member.id);
    const db = await signedInClient(member);
    expect((await db.rpc("attend_live", { p_session_id: early })).error?.message).toMatch(
      /не е започнала/,
    );
    expect((await db.rpc("attend_live", { p_session_id: late })).error?.message).toMatch(
      /приключи/,
    );
    expect((await db.rpc("attend_live", { p_session_id: draft })).error?.code).toBe("P0002");
    const noAccess = await signedInClient(await createUser(admin, "live-noaccess"));
    expect((await noAccess.rpc("attend_live", { p_session_id: early })).error?.code).toBe("42501");
  });

  it("articles carry a category: article by default, recipe allowed, nothing else", async () => {
    const admin = adminClient();
    const { db } = await createAdminUser(admin, "live-articles-admin");
    const base = { slug: `recipe-${Date.now()}`, title: "Овесени палачинки", body: "..." };
    const { data, error } = await db.from("articles").insert(base).select("category").single();
    expect(error).toBeNull();
    expect(data?.category).toBe("article");
    const recipe = await db
      .from("articles")
      .insert({ ...base, slug: `${base.slug}-r`, category: "recipe" })
      .select("category")
      .single();
    expect(recipe.data?.category).toBe("recipe");
    const bad = await db
      .from("articles")
      .insert({ ...base, slug: `${base.slug}-x`, category: "video" });
    expect(bad.error?.code).toBe("23514");
  });

  it("attendance is written by the RPC only, and a session with attendance cannot be deleted", async () => {
    const { admin, id } = await session(minutes(5));
    const member = await createUser(admin, "live-direct");
    await grantAccess(admin, member.id);
    const db = await signedInClient(member);
    const direct = await db.from("live_attendance").insert({ session_id: id, user_id: member.id });
    expect(direct.error?.code).toBe("42501");
    expect((await db.rpc("attend_live", { p_session_id: id })).error).toBeNull();
    const { db: adminDb } = await createAdminUser(admin, "live-deleter");
    const del = await adminDb.from("live_sessions").delete().eq("id", id);
    expect(del.error?.code).toBe("23503");
  });
});
