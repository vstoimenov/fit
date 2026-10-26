import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createAdminUser, createUser, signedInClient } from "./helpers";

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** The app calls the RPC with the service role from a server action, never from the browser. */
async function submit(
  email: string,
  opts: { name?: string; marketing?: boolean; ip?: string } = {},
) {
  return adminClient().rpc("submit_lead", {
    p_name: opts.name ?? "Мария",
    p_email: email,
    p_marketing: opts.marketing ?? false,
    p_source: "free-workout",
    p_ip_hash: opts.ip ?? `ip-${stamp()}`,
  });
}

describe("submit_lead", () => {
  it("is not callable with the public (anon) key", async () => {
    const { error } = await anonClient().rpc("submit_lead", {
      p_name: "Бот",
      p_email: `bot-${stamp()}@example.test`,
      p_marketing: false,
      p_source: "free-workout",
      p_ip_hash: "",
    });
    expect(error).not.toBeNull();
  });

  it("inserts once per e-mail (case-insensitively), then refreshes the row", async () => {
    const email = `lead-${stamp()}@example.test`;
    const first = await submit(` ${email.toUpperCase()} `);
    expect(first.error).toBeNull();
    expect(first.data).toBe(true);
    const second = await submit(email, { name: "Мария Иванова", marketing: true });
    expect(second.error).toBeNull();
    expect(second.data).toBe(false);

    const { data } = await adminClient()
      .from("leads")
      .select("name, email, marketing_consent_at, source")
      .eq("email", email);
    expect(data).toHaveLength(1);
    expect(data![0].name).toBe("Мария Иванова");
    expect(data![0].marketing_consent_at).not.toBeNull();
    expect(data![0].source).toBe("free-workout");

    const direct = await anonClient().from("leads").select("id");
    expect(direct.data ?? []).toEqual([]);
  });

  it("refuses the 11th lead from one ip within an hour", async () => {
    const ip = `ip-${stamp()}`;
    for (let i = 0; i < 10; i++) {
      const { error } = await submit(`lead-${stamp()}-${i}@example.test`, { ip });
      expect(error).toBeNull();
    }
    const { error } = await submit(`lead-${stamp()}-11@example.test`, { ip });
    expect(error?.message).toContain("rate_limited");
  });

  it("forgets ip hashes older than 30 days", async () => {
    const admin = adminClient();
    const email = `old-${stamp()}@example.test`;
    await submit(email, { ip: "old-hash" });
    const { error } = await admin
      .from("leads")
      .update({ created_at: new Date(Date.now() - 40 * 86400000).toISOString() })
      .eq("email", email);
    expect(error).toBeNull();
    await submit(`fresh-${stamp()}@example.test`);
    const { data } = await admin.from("leads").select("ip_hash").eq("email", email).single();
    expect(data?.ip_hash).toBeNull();
  });

  it("only admins read leads", async () => {
    const admin = adminClient();
    const email = `lead-${stamp()}@example.test`;
    await submit(email);

    const member = await createUser(admin, "lead-member");
    const memberDb = await signedInClient(member);
    expect((await memberDb.from("leads").select("id").eq("email", email)).data ?? []).toEqual([]);

    const { db: adminDb } = await createAdminUser(admin, "lead-admin");
    const { data } = await adminDb.from("leads").select("email").eq("email", email);
    expect(data).toEqual([{ email }]);
  });
});
