import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createAdminUser, createUser, signedInClient } from "./helpers";

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function submit(
  email: string,
  opts: { name?: string; marketing?: boolean; ip?: string } = {},
) {
  return anonClient().rpc("submit_lead", {
    p_name: opts.name ?? "Мария",
    p_email: email,
    p_marketing: opts.marketing ?? false,
    p_source: "free-workout",
    p_ip_hash: opts.ip ?? `ip-${stamp()}`,
  });
}

describe("submit_lead", () => {
  it("anon upserts a lead by e-mail, case-insensitively, and cannot read it back", async () => {
    const email = `lead-${stamp()}@example.test`;
    const first = await submit(` ${email.toUpperCase()} `);
    expect(first.error).toBeNull();
    const second = await submit(email, { name: "Мария Иванова", marketing: true });
    expect(second.error).toBeNull();

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
