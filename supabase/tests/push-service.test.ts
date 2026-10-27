import { describe, expect, it } from "vitest";
import { claimSubscription, saveSubscription } from "@/server/push/subscriptions";
import { adminClient, createUser } from "./helpers";

const admin = adminClient();
const device = (n: number, auth = "authsecret") => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/svc-${n}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  keys: { p256dh: "BHxk-p256dh", auth },
});

async function rowsOf(userId: string) {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", userId);
  if (error) throw error;
  return data.map((r) => r.endpoint);
}

describe("push subscriptions (server)", () => {
  it("keeps at most 10 devices per account, dropping the oldest, even on direct inserts", async () => {
    const me = await createUser(admin, "push-cap");
    const devices = Array.from({ length: 12 }, (_, i) => device(i));
    for (const d of devices) {
      const { error } = await admin.from("push_subscriptions").insert({
        user_id: me.id,
        endpoint: d.endpoint,
        p256dh: d.keys.p256dh,
        auth: d.keys.auth,
      });
      expect(error).toBeNull();
    }
    const kept = await rowsOf(me.id);
    expect(kept).toHaveLength(10);
    expect(kept).not.toContain(devices[0]!.endpoint);
    expect(kept).toContain(devices[11]!.endpoint);
  });

  it("claim moves a device only for a caller who holds its auth secret, and never creates one", async () => {
    const first = await createUser(admin, "push-claim-a");
    const second = await createUser(admin, "push-claim-b");
    const phone = device(1, "phone-secret");
    await saveSubscription(admin, first.id, phone, "ua");

    // Someone who only learned the endpoint cannot take the device.
    expect(
      await claimSubscription(admin, second.id, {
        ...phone,
        keys: { ...phone.keys, auth: "guess" },
      }),
    ).toBe(false);
    expect(await rowsOf(first.id)).toEqual([phone.endpoint]);

    // The same browser (it holds the secret) signs in as someone else: the device follows her.
    expect(await claimSubscription(admin, second.id, phone)).toBe(true);
    expect(await rowsOf(first.id)).toEqual([]);
    expect(await rowsOf(second.id)).toEqual([phone.endpoint]);

    // An endpoint the server does not know is not inserted by a claim.
    const unknown = device(2);
    expect(await claimSubscription(admin, second.id, unknown)).toBe(false);
    expect(await rowsOf(second.id)).toEqual([phone.endpoint]);
  });
});
