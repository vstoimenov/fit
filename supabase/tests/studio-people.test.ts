import { describe, expect, it } from "vitest";
import { claimStudioInvite, createStudioInvite } from "@/server/studio/invite";
import { joinStudio } from "@/server/studio/join";
import { createWalkIn } from "@/server/studio/walkin";
import { adminClient, anonClient, createUser, signedInClient } from "./helpers";
import { studioCard } from "./studio-helpers";

const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

describe("joining", () => {
  it("saves her name and phone and marks her as an in-person client", async () => {
    const admin = adminClient();
    const user = await createUser(admin, "join");
    const db = await signedInClient(user);
    expect(await joinStudio(db, { name: " Мария Иванова ", phone: "0888 123 456" })).toEqual({
      ok: true,
    });
    const { data } = await admin
      .from("profiles")
      .select("name, phone, studio_client")
      .eq("id", user.id)
      .single();
    expect(data).toEqual({ name: "Мария Иванова", phone: "0888 123 456", studio_client: true });
  });

  it("asks for a real phone", async () => {
    const admin = adminClient();
    const db = await signedInClient(await createUser(admin, "join-bad"));
    expect(await joinStudio(db, { name: "Мария", phone: "123" })).toEqual({
      ok: false,
      message: "Остави телефон, за да ти пише Аксения при промяна.",
    });
  });
});

describe("walk-ins and invites", () => {
  it("a walk-in gets a placeholder e-mail and cannot sign in", async () => {
    const admin = adminClient();
    const res = await createWalkIn(admin, { name: "Гергана", phone: "0899111222" });
    expect(res.ok).toBe(true);
    const userId = (res as { userId: string }).userId;
    const { data } = await admin
      .from("profiles")
      .select("name, phone, email, studio_client")
      .eq("id", userId)
      .single();
    expect(data).toMatchObject({ name: "Гергана", phone: "0899111222", studio_client: true });
    expect(data!.email).toMatch(/@na-myasto\.invalid$/);
    const attempt = await anonClient().auth.signInWithPassword({
      email: data!.email,
      password: "anything-at-all",
    });
    expect(attempt.error).not.toBeNull();
  });

  it("claiming an invite gives the walk-in her own login, and her card follows", async () => {
    const admin = adminClient();
    const { userId } = (await createWalkIn(admin, { name: "Деси", phone: "0899222333" })) as {
      userId: string;
    };
    const card = await studioCard(admin, userId);
    const token = await createStudioInvite(admin, userId, null);
    const email = uniqueEmail("claim");
    expect(await claimStudioInvite(admin, token, { email, password: "parola-1234" })).toEqual({
      ok: true,
      email,
    });
    const db = anonClient();
    expect((await db.auth.signInWithPassword({ email, password: "parola-1234" })).error).toBeNull();
    const { data } = await db.from("studio_card_status").select("id");
    expect(data).toEqual([{ id: card }]);
    // Used once.
    expect(
      await claimStudioInvite(admin, token, {
        email: uniqueEmail("again"),
        password: "parola-1234",
      }),
    ).toEqual({ ok: false, message: "Поканата е невалидна или изтекла." });
  });

  it("refuses unknown and expired tokens", async () => {
    const admin = adminClient();
    const invalid = { ok: false, message: "Поканата е невалидна или изтекла." };
    expect(
      await claimStudioInvite(admin, "nope", { email: uniqueEmail("x"), password: "parola-1234" }),
    ).toEqual(invalid);
    const { userId } = (await createWalkIn(admin, { name: "Ива", phone: "0899333444" })) as {
      userId: string;
    };
    const old = new Date(Date.now() - 15 * 86_400_000);
    const token = await createStudioInvite(admin, userId, null, old);
    expect(
      await claimStudioInvite(admin, token, { email: uniqueEmail("old"), password: "parola-1234" }),
    ).toEqual(invalid);
  });

  it("does not invite someone who already has a real login", async () => {
    const admin = adminClient();
    const user = await createUser(admin, "has-login");
    await expect(createStudioInvite(admin, user.id, null)).rejects.toThrow();
  });

  it("an e-mail that is already taken is refused and the invite stays usable", async () => {
    const admin = adminClient();
    const taken = await createUser(admin, "taken");
    const { userId } = (await createWalkIn(admin, { name: "Нели", phone: "0899444555" })) as {
      userId: string;
    };
    const token = await createStudioInvite(admin, userId, null);
    expect(
      await claimStudioInvite(admin, token, { email: taken.email, password: "parola-1234" }),
    ).toEqual({ ok: false, message: "Вече има профил с този имейл. Влез от „Имам профил“." });
    const email = uniqueEmail("second-try");
    expect(await claimStudioInvite(admin, token, { email, password: "parola-1234" })).toEqual({
      ok: true,
      email,
    });
  });
});
