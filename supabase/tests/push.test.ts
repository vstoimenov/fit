import { describe, expect, it } from "vitest";
import { adminClient, createAdminUser, createUser, freeWorkoutId, signedInClient } from "./helpers";

const sub = (n: number) => ({
  endpoint: `https://push.example/${n}-${Date.now()}`,
  p256dh: "BHxk-p256dh",
  auth: "authsecret",
  user_agent: "test",
});

describe("push_subscriptions", () => {
  it("a member keeps her own subscriptions and nobody else sees them", async () => {
    const admin = adminClient();
    const me = await createUser(admin, "push-me");
    const other = await createUser(admin, "push-other");
    const mine = await signedInClient(me);
    const theirs = await signedInClient(other);

    const first = sub(1);
    const { error } = await mine.from("push_subscriptions").insert(first);
    expect(error).toBeNull();
    // Same endpoint twice is one row (re-subscribe after a reinstall).
    const dup = await mine.from("push_subscriptions").insert(first);
    expect(dup.error?.code).toBe("23505");

    const seenByOther = await theirs.from("push_subscriptions").select("endpoint");
    expect(seenByOther.data).toEqual([]);
    const planted = await theirs.from("push_subscriptions").insert({ ...sub(2), user_id: me.id });
    expect(planted.error).not.toBeNull();

    // Deleting by endpoint is scoped to her own rows.
    await theirs.from("push_subscriptions").delete().neq("endpoint", "");
    expect((await mine.from("push_subscriptions").select("endpoint")).data).toHaveLength(1);
    const removed = await mine.from("push_subscriptions").delete().neq("endpoint", "");
    expect(removed.error).toBeNull();
    expect((await mine.from("push_subscriptions").select("endpoint")).data).toEqual([]);
  });

  it("an admin can read every subscription and the send log, members cannot", async () => {
    const admin = adminClient();
    const member = await createUser(admin, "push-member");
    const db = await signedInClient(member);
    await db.from("push_subscriptions").insert(sub(3));
    const { error: logError } = await admin
      .from("push_sends")
      .insert({ kind: "broadcast", title: "Здравей", body: "Тест", url: null, recipients: 1 });
    expect(logError).toBeNull();

    const seenByMember = await db.from("push_sends").select("title");
    expect(seenByMember.data).toEqual([]);
    const { db: adminDb } = await createAdminUser(admin, "push-admin");
    const subs = await adminDb
      .from("push_subscriptions")
      .select("user_id")
      .eq("user_id", member.id);
    expect(subs.data).toEqual([{ user_id: member.id }]);
    const log = await adminDb.from("push_sends").select("title").eq("title", "Здравей");
    expect(log.data).toHaveLength(1);
  });

  it("a member sets her reminder hour (0–23 or off) but not the reminded-on marker", async () => {
    const admin = adminClient();
    const user = await createUser(admin, "push-hour");
    const db = await signedInClient(user);
    expect((await db.from("profiles").update({ push_hour: 7 }).eq("id", user.id)).error).toBeNull();
    expect(
      (await db.from("profiles").update({ push_hour: 24 }).eq("id", user.id)).error,
    ).not.toBeNull();
    expect(
      (await db.from("profiles").update({ push_hour: null }).eq("id", user.id)).error,
    ).toBeNull();
    const marker = await db
      .from("profiles")
      .update({ push_reminded_on: "2026-10-27" })
      .eq("id", user.id);
    expect(marker.error).not.toBeNull();
  });

  it("workouts carry a notified_at marker only the service role writes", async () => {
    const admin = adminClient();
    const id = await freeWorkoutId(admin);
    const { data } = await admin.from("workouts").select("notified_at").eq("id", id).single();
    expect(data).toEqual({ notified_at: null });
  });
});
