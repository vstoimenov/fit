import { describe, expect, it } from "vitest";
import { subscriptionSchema } from "./subscriptions";

describe("subscriptionSchema", () => {
  it("accepts what PushSubscription.toJSON() gives", () => {
    const parsed = subscriptionSchema.parse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      expirationTime: null,
      keys: { p256dh: "BHxk", auth: "sec" },
    });
    expect(parsed).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "BHxk", auth: "sec" },
    });
  });

  it("accepts only the browsers' push services, never an arbitrary host", () => {
    const ok = (endpoint: string) =>
      subscriptionSchema.safeParse({ endpoint, keys: { p256dh: "a", auth: "b" } }).success;
    expect(ok("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(ok("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(ok("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
    expect(ok("https://web.push.apple.com/abc")).toBe(true);
    expect(ok("https://attacker.example/collect")).toBe(false);
    expect(ok("https://169.254.169.254/latest")).toBe(false);
    expect(ok("https://fcm.googleapis.com.evil.example/x")).toBe(false);
  });

  it("rejects non-https endpoints and missing keys", () => {
    expect(() =>
      subscriptionSchema.parse({ endpoint: "http://x", keys: { p256dh: "a", auth: "b" } }),
    ).toThrow();
    expect(() =>
      subscriptionSchema.parse({ endpoint: "https://x", keys: { p256dh: "a" } }),
    ).toThrow();
  });
});
