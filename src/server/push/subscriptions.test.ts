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

  it("rejects non-https endpoints and missing keys", () => {
    expect(() =>
      subscriptionSchema.parse({ endpoint: "http://x", keys: { p256dh: "a", auth: "b" } }),
    ).toThrow();
    expect(() =>
      subscriptionSchema.parse({ endpoint: "https://x", keys: { p256dh: "a" } }),
    ).toThrow();
  });
});
