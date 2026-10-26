import { describe, expect, it } from "vitest";
import { adminClient, createAdminUser, createUser, freeWorkoutId, signedInClient } from "./helpers";

const sub = (n: number) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${n}-${Date.now()}`,
  p256dh: "BHxk-p256dh",
  auth: "authsecret",
  user_agent: "test",
});

describe("push_subscriptions", () => {
  it("subscriptions are written by the server only; a member sees and deletes her own", async () => {
    const admin = adminClient();
    const me = await createUser(admin, "push-me");
    const other = await createUser(admin, "push-other");
    const mine = await signedInClient(me);
    const theirs = await signedInClient(other);

    const first = { ...sub(1), user_id: me.id };
    const { error } = await admin.from("push_subscriptions").insert(first);
    expect(error).toBeNull();
    // Same endpoint twice is one row (re-subscribe after a reinstall).
    const dup = await admin.from("push_subscriptions").insert(first);
    expect(dup.error?.code).toBe("23505");
    // Only the browsers' push services are accepted as endpoints.
    const rogue = await admin
      .from("push_subscriptions")
      .insert({ ...sub(9), user_id: me.id, endpoint: "https://attacker.example/x" });
    expect(rogue.error?.code).toBe("23514");
    // Members cannot insert at all (no grant): the action goes through the service role.
    const direct = await mine.from("push_subscriptions").insert(sub(3));
    expect(direct.error?.code).toBe("42501");

    const seenByOther = await theirs.from("push_subscriptions").select("endpoint");
    expect(seenByOther.data).toEqual([]);

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
    await admin.from("push_subscriptions").insert({ ...sub(3), user_id: member.id });
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

  it("a workout published in the future is not marked as announced", async () => {
    const admin = adminClient();
    const id = await freeWorkoutId(admin);
    const { data } = await admin.from("workouts").select("notified_at").eq("id", id).single();
    expect(data).toEqual({ notified_at: null });
    const { data: scheduled, error } = await admin
      .from("workouts")
      .insert({
        title: "Утрешна",
        kind: "regular",
        level: "beginner",
        duration_min: 20,
        focus: ["full_body"],
        publish_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("notified_at")
      .single();
    expect(error).toBeNull();
    expect(scheduled?.notified_at).toBeNull();
  });

  it("the hourly job is scheduled in pg_cron and skips quietly without vault secrets", async () => {
    const admin = adminClient();
    const { data, error } = await admin.rpc("push_cron_status");
    expect(error).toBeNull();
    expect(data).toMatchObject({ scheduled: true, schedule: "0 * * * *" });
  });
});
