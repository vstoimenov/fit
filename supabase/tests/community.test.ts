import { describe, expect, it } from "vitest";
import { adminClient, createAdminUser, createUser, grantAccess, signedInClient } from "./helpers";

async function member(label: string) {
  const admin = adminClient();
  const user = await createUser(admin, label);
  await grantAccess(admin, user.id);
  await admin.from("profiles").update({ name: "Мария Петрова" }).eq("id", user.id);
  return { admin, user, db: await signedInClient(user) };
}

describe("community", () => {
  it("a member with access posts, others with access read it with first name + initial", async () => {
    const { admin, db } = await member("cm-author");
    const { data: postId, error } = await db.rpc("create_post", {
      p_body: "Първа тренировка готова!",
      p_photo_path: "",
      p_completion_id: "",
    });
    expect(error).toBeNull();
    const reader = await member("cm-reader");
    const { data: feed } = await reader.db.rpc("community_feed", { p_before: "", p_limit: 20 });
    const row = (feed as Array<Record<string, unknown>>).find((r) => r.id === postId);
    expect(row).toMatchObject({
      body: "Първа тренировка готова!",
      author_name: "Мария П.",
      hearts: 0,
      comments: 0,
      hearted_by_me: false,
    });
    // Tables are never read or written directly.
    expect((await db.from("community_posts").select("id")).error?.code).toBe("42501");
    const visitor = await signedInClient(await createUser(admin, "cm-visitor"));
    expect((await visitor.rpc("community_feed", { p_before: "", p_limit: 20 })).error?.code).toBe(
      "42501",
    );
    expect(
      (await visitor.rpc("create_post", { p_body: "x", p_photo_path: "", p_completion_id: "" }))
        .error?.code,
    ).toBe("42501");
  });

  it("hearts toggle, comments count, and points stop at the daily cap", async () => {
    const { admin, user, db } = await member("cm-points");
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { data } = await db.rpc("create_post", {
        p_body: `Пост ${i}`,
        p_photo_path: "",
        p_completion_id: "",
      });
      ids.push(data as string);
    }
    const other = await member("cm-other");
    expect((await other.db.rpc("toggle_heart", { p_post_id: ids[0]! })).data).toBe(true);
    expect((await other.db.rpc("toggle_heart", { p_post_id: ids[0]! })).data).toBe(false);
    expect((await other.db.rpc("toggle_heart", { p_post_id: ids[0]! })).data).toBe(true);
    expect(
      (await other.db.rpc("create_comment", { p_post_id: ids[0]!, p_body: "Браво!" })).error,
    ).toBeNull();
    const { data: post } = await other.db.rpc("community_post", { p_id: ids[0]! });
    expect((post as Record<string, unknown>).hearts).toBe(1);
    expect(((post as Record<string, unknown>).comments as unknown[]).length).toBe(1);
    // Two posts = 3 + 2 (cap 5), nothing more today.
    const { data: ledger } = await admin
      .from("points_ledger")
      .select("points")
      .eq("user_id", user.id)
      .in("source", ["post", "comment"]);
    expect(ledger?.reduce((s, r) => s + r.points, 0)).toBe(5);
    await db.rpc("create_comment", { p_post_id: ids[1]!, p_body: "и коментар" });
    const { data: after } = await admin
      .from("points_ledger")
      .select("points")
      .eq("user_id", user.id)
      .in("source", ["post", "comment"]);
    expect(after?.reduce((s, r) => s + r.points, 0)).toBe(5);
  });

  it("the author deletes her own post; the owner hides and sees reports", async () => {
    const { admin, db } = await member("cm-mod-author");
    const { data: postId } = await db.rpc("create_post", {
      p_body: "Спорно",
      p_photo_path: "",
      p_completion_id: "",
    });
    const reporter = await member("cm-reporter");
    expect(
      (
        await reporter.db.rpc("report_content", {
          p_post_id: postId as string,
          p_comment_id: "",
          p_reason: "Реклама",
        })
      ).error,
    ).toBeNull();
    const { db: adminDb } = await createAdminUser(admin, "cm-admin");
    const { data: reports } = await adminDb.rpc("community_reports");
    expect((reports as Array<Record<string, unknown>>).some((r) => r.post_id === postId)).toBe(
      true,
    );
    expect(
      (await adminDb.rpc("admin_moderate_post", { p_id: postId as string, p_hidden: true })).error,
    ).toBeNull();
    const { data: feed } = await reporter.db.rpc("community_feed", { p_before: "", p_limit: 20 });
    expect((feed as Array<Record<string, unknown>>).some((r) => r.id === postId)).toBe(false);
    expect((await reporter.db.rpc("delete_own_post", { p_id: postId as string })).error?.code).toBe(
      "P0002",
    );
    expect((await db.rpc("delete_own_post", { p_id: postId as string })).error).toBeNull();
  });

  it("limits posts per day and rejects empty or too long text", async () => {
    const { db } = await member("cm-limits");
    expect(
      (await db.rpc("create_post", { p_body: "   ", p_photo_path: "", p_completion_id: "" })).error
        ?.code,
    ).toBe("22023");
    expect(
      (
        await db.rpc("create_post", {
          p_body: "x".repeat(1001),
          p_photo_path: "",
          p_completion_id: "",
        })
      ).error?.code,
    ).toBe("22023");
    for (let i = 0; i < 5; i++) {
      expect(
        (await db.rpc("create_post", { p_body: `П${i}`, p_photo_path: "", p_completion_id: "" }))
          .error,
      ).toBeNull();
    }
    expect(
      (await db.rpc("create_post", { p_body: "шести", p_photo_path: "", p_completion_id: "" }))
        .error?.message,
    ).toMatch(/5/);
  });
});
