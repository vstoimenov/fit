import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/admin/time";
import { adminClient, createAdminUser, createUser, signedInClient } from "./helpers";
import { hours, remaining, sofiaToday, studioCard, studioSession } from "./studio-helpers";

async function setup(label: string) {
  const admin = adminClient();
  const { db: trainer } = await createAdminUser(admin, `${label}-admin`);
  const user = await createUser(admin, label);
  return { admin, trainer, user, db: await signedInClient(user) };
}

async function grant(
  trainer: Awaited<ReturnType<typeof setup>>["trainer"],
  userId: string,
  kind: "card8" | "card12",
  startsOn: string,
  usedBefore = 0,
) {
  const { data, error } = await trainer.rpc("studio_grant_card", {
    p_user_id: userId,
    p_kind: kind,
    p_starts_on: startsOn,
    p_used_before: usedBefore,
  });
  if (error) throw error;
  return data as { card_id: string; moved: number };
}

describe("studio cards", () => {
  it("Карта 8 from 3.11 ends 30.11 with 8 visits; Карта 12 gets 12 visits for 6 weeks", async () => {
    const { admin, trainer, user } = await setup("grant");
    const { card_id } = await grant(trainer, user.id, "card8", "2026-11-03");
    const { data } = await admin
      .from("studio_cards")
      .select("visits, starts_on, ends_on, created_by")
      .eq("id", card_id)
      .single();
    expect(data).toMatchObject({ visits: 8, starts_on: "2026-11-03", ends_on: "2026-11-30" });
    expect(data?.created_by).not.toBeNull();
    const twelve = await grant(trainer, user.id, "card12", "2026-11-03");
    const { data: d12 } = await admin
      .from("studio_cards")
      .select("visits, ends_on")
      .eq("id", twelve.card_id)
      .single();
    expect(d12).toEqual({ visits: 12, ends_on: "2026-12-14" });
  });

  it("moving the notebook over: a past start with 5 used leaves 3", async () => {
    const { admin, trainer, user } = await setup("import");
    const { card_id } = await grant(trainer, user.id, "card8", addDays(sofiaToday(), -10), 5);
    expect(await remaining(admin, card_id)).toBe(3);
    const { data: profile } = await admin
      .from("profiles")
      .select("studio_client")
      .eq("id", user.id)
      .single();
    expect(profile?.studio_client).toBe(true);
  });

  it("granting moves drop-in bookings in range onto the card, oldest first, up to its visits", async () => {
    const { admin, trainer, user, db } = await setup("move");
    const s1 = await studioSession(admin, hours(30));
    const s2 = await studioSession(admin, hours(54));
    const s3 = await studioSession(admin, hours(78));
    for (const s of [s1, s2, s3]) await db.rpc("studio_book", { p_session_id: s });
    // Two visits left (6 already used): the two oldest move, the third stays a drop-in.
    const { card_id, moved } = await grant(trainer, user.id, "card8", sofiaToday(), 6);
    expect(moved).toBe(2);
    const { data } = await admin
      .from("studio_bookings")
      .select("session_id, card_id")
      .eq("user_id", user.id)
      .eq("status", "booked");
    const bySession = Object.fromEntries((data ?? []).map((b) => [b.session_id, b.card_id]));
    expect(bySession).toEqual({ [s1]: card_id, [s2]: card_id, [s3]: null });
    expect(await remaining(admin, card_id)).toBe(0);
  });

  it("a drop-in outside the card's dates stays a drop-in", async () => {
    const { admin, trainer, user, db } = await setup("move-out");
    const s = await studioSession(admin, hours(30));
    await db.rpc("studio_book", { p_session_id: s });
    const { moved } = await grant(trainer, user.id, "card8", addDays(sofiaToday(), 5));
    expect(moved).toBe(0);
  });

  it("void refuses a card in use; an unused voided card is never picked", async () => {
    const { admin, trainer, user, db } = await setup("void");
    const used = await studioCard(admin, user.id);
    await db.rpc("studio_book", { p_session_id: await studioSession(admin, hours(30)) });
    expect((await trainer.rpc("studio_void_card", { p_card_id: used })).error?.message).toContain(
      "card in use",
    );

    const other = await createUser(admin, "void-unused");
    const otherDb = await signedInClient(other);
    const unused = await studioCard(admin, other.id);
    expect((await trainer.rpc("studio_void_card", { p_card_id: unused })).error).toBeNull();
    const { data } = await otherDb.rpc("studio_book", {
      p_session_id: await studioSession(admin, hours(30)),
    });
    expect(data).toMatchObject({ card_id: null });
  });

  it("adjusting changes remaining with a reason she can see; below zero is refused", async () => {
    const { admin, trainer, user, db } = await setup("adjust");
    const card = await studioCard(admin, user.id);
    expect(
      (
        await trainer.rpc("studio_adjust_card", {
          p_card_id: card,
          p_delta: -2,
          p_reason: "две пропуснати",
        })
      ).error,
    ).toBeNull();
    expect(await remaining(admin, card)).toBe(6);
    const { data } = await db.from("studio_card_adjustments").select("delta, reason");
    expect(data).toEqual([{ delta: -2, reason: "две пропуснати" }]);
    expect(
      (
        await trainer.rpc("studio_adjust_card", {
          p_card_id: card,
          p_delta: -7,
          p_reason: "грешка",
        })
      ).error?.message,
    ).toContain("negative");
  });

  it("a client cannot grant, void or adjust", async () => {
    const { admin, user, db } = await setup("card-guard");
    const card = await studioCard(admin, user.id);
    const calls = [
      db.rpc("studio_grant_card", {
        p_user_id: user.id,
        p_kind: "card8",
        p_starts_on: sofiaToday(),
        p_used_before: 0,
      }),
      db.rpc("studio_void_card", { p_card_id: card }),
      db.rpc("studio_adjust_card", { p_card_id: card, p_delta: 5, p_reason: "подарък" }),
    ];
    for (const { error } of await Promise.all(calls)) expect(error?.code).toBe("42501");
  });
});

describe("studio cards (server)", () => {
  it("grantStudioCard validates used-before against the card's visits", async () => {
    const { grantStudioCard } = await import("@/server/studio/cards");
    const { trainer, user } = await setup("srv-grant");
    const bad = await grantStudioCard(trainer, {
      userId: user.id,
      kind: "card8",
      startsOn: sofiaToday(),
      usedBefore: 8,
    });
    expect(bad).toEqual({ ok: false, message: "Използваните са повече от посещенията на картата" });
    const good = await grantStudioCard(trainer, {
      userId: user.id,
      kind: "card8",
      startsOn: sofiaToday(),
      usedBefore: 0,
    });
    expect(good).toEqual({ ok: true, moved: 0 });
  });

  it("listStudioClients shows each in-person client with her current card and warning", async () => {
    const { listStudioClients } = await import("@/server/studio/cards");
    const { admin, trainer, user } = await setup("srv-list");
    await admin
      .from("profiles")
      .update({ name: "Тест Клиентка", phone: "0888123456" })
      .eq("id", user.id);
    await grant(trainer, user.id, "card8", sofiaToday(), 7);
    const rows = await listStudioClients(trainer, sofiaToday());
    const row = rows.find((r) => r.userId === user.id);
    expect(row).toMatchObject({
      name: "Тест Клиентка",
      phone: "0888123456",
      email: user.email,
      hasLogin: true,
      warning: "low",
    });
    expect(row?.card?.remaining).toBe(1);
  });
});
