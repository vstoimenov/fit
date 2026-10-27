import { describe, expect, it } from "vitest";
import { adminClient, createAdminUser, createUser, grantAccess, signedInClient } from "./helpers";

async function issued(months = 3) {
  const admin = adminClient();
  const { db } = await createAdminUser(admin, "gift-issuer");
  const { data, error } = await db.rpc("issue_gift_voucher", {
    p_months: months,
    p_recipient_name: "Ива",
    p_note: "giveaway",
  });
  if (error) throw error;
  return { admin, code: data as string };
}

describe("gift vouchers", () => {
  it("an admin issues a voucher; members cannot read or write the table", async () => {
    const { admin, code } = await issued();
    expect(code).toMatch(/^[A-Z2-9]{10}$/);
    const member = await signedInClient(await createUser(admin, "gift-reader"));
    expect((await member.from("gift_vouchers").select("code")).data).toEqual([]);
    const insert = await member
      .from("gift_vouchers")
      .insert({ code: "ABCDEFGH23", months: 1, amount_cents: 0, kind: "manual" });
    expect(insert.error).not.toBeNull();
    const notAdmin = await member.rpc("issue_gift_voucher", {
      p_months: 1,
      p_recipient_name: "",
      p_note: "",
    });
    expect(notAdmin.error?.code).toBe("42501");
  });

  it("a member redeems a code once and gets the months as manual access", async () => {
    const { admin, code } = await issued(3);
    const user = await createUser(admin, "gift-redeemer");
    const db = await signedInClient(user);
    const before = Date.now();
    const { data: end, error } = await db.rpc("redeem_gift_voucher", {
      p_code: `iam-${code.slice(0, 5)}-${code.slice(5)}`,
    });
    expect(error).toBeNull();
    const months = (new Date(end as string).getTime() - before) / (30 * 86_400_000);
    expect(months).toBeGreaterThan(2.9);
    expect(months).toBeLessThan(3.2);
    expect((await db.rpc("my_access")).data).toBe(true);
    const again = await db.rpc("redeem_gift_voucher", { p_code: code });
    expect(again.error?.message).toMatch(/used/);
    const { data: row } = await admin
      .from("gift_vouchers")
      .select("redeemed_by")
      .eq("code", code)
      .single();
    expect(row?.redeemed_by).toBe(user.id);
  });

  it("extends an existing manual period instead of replacing it", async () => {
    const { admin, code } = await issued(1);
    const user = await createUser(admin, "gift-extend");
    await grantAccess(admin, user.id); // manual access, some days ahead
    const { data: sub } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", user.id)
      .single();
    const db = await signedInClient(user);
    const { data: end, error } = await db.rpc("redeem_gift_voucher", { p_code: code });
    expect(error).toBeNull();
    const gained = new Date(end as string).getTime() - new Date(sub!.current_period_end!).getTime();
    expect(gained / 86_400_000).toBeGreaterThan(27);
  });

  it("refuses unknown and expired codes without consuming anything", async () => {
    const { admin, code } = await issued(1);
    await admin.from("gift_vouchers").update({ expires_at: "2020-01-01" }).eq("code", code);
    const db = await signedInClient(await createUser(admin, "gift-expired"));
    expect((await db.rpc("redeem_gift_voucher", { p_code: code })).error?.message).toMatch(
      /expired/,
    );
    expect((await db.rpc("redeem_gift_voucher", { p_code: "NOPE" })).error?.message).toMatch(
      /not found/,
    );
    expect((await db.rpc("my_access")).data).toBe(false);
  });

  it("is not consumed while a paid subscription is live", async () => {
    const { admin, code } = await issued(1);
    const user = await createUser(admin, "gift-paid");
    await admin.from("subscriptions").upsert({
      user_id: user.id,
      provider: "stripe",
      status: "active",
      current_period_end: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    });
    const db = await signedInClient(user);
    expect((await db.rpc("redeem_gift_voucher", { p_code: code })).error?.message).toMatch(/paid/);
    const { data: row } = await admin
      .from("gift_vouchers")
      .select("redeemed_at")
      .eq("code", code)
      .single();
    expect(row?.redeemed_at).toBeNull();
  });

  it("is refused while a paid subscription is still open (past_due beyond grace), untouched", async () => {
    const { admin, code } = await issued(1);
    const user = await createUser(admin, "gift-pastdue");
    await admin.from("subscriptions").upsert({
      user_id: user.id,
      provider: "stripe",
      provider_sub_id: "sub_open",
      status: "past_due",
      grace_until: new Date(Date.now() - 86_400_000).toISOString(),
      current_period_end: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    });
    const db = await signedInClient(user);
    const res = await db.rpc("redeem_gift_voucher", { p_code: code });
    expect(res.error?.code).toBe("P0003");
    const { data: row } = await admin
      .from("gift_vouchers")
      .select("redeemed_at")
      .eq("code", code)
      .single();
    expect(row?.redeemed_at).toBeNull();
  });

  it("converts an ended Stripe subscription into manual months", async () => {
    const { admin, code } = await issued(1);
    const user = await createUser(admin, "gift-ended");
    await admin.from("subscriptions").upsert({
      user_id: user.id,
      provider: "stripe",
      provider_sub_id: "sub_old",
      status: "canceled",
      current_period_end: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const db = await signedInClient(user);
    const { error } = await db.rpc("redeem_gift_voucher", { p_code: code });
    expect(error).toBeNull();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("provider, status")
      .eq("user_id", user.id)
      .single();
    expect(sub).toEqual({ provider: "manual", status: "active" });
  });

  it("an admin voids an unredeemed voucher; it can no longer be redeemed", async () => {
    const { admin, code } = await issued(1);
    const { db: adminDb } = await createAdminUser(admin, "gift-voider");
    const { data: row } = await admin.from("gift_vouchers").select("id").eq("code", code).single();
    expect((await adminDb.rpc("void_gift_voucher", { p_id: row!.id })).error).toBeNull();
    const db = await signedInClient(await createUser(admin, "gift-void-user"));
    expect((await db.rpc("redeem_gift_voucher", { p_code: code })).error?.message).toMatch(
      /voided/,
    );
    const member = await signedInClient(await createUser(admin, "gift-void-member"));
    expect((await member.rpc("void_gift_voucher", { p_id: row!.id })).error?.code).toBe("42501");
  });
});
