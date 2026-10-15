import { describe, expect, it } from "vitest";
import { clientEnvSchema, parseEnv, serverEnvSchema } from "./env-schema";

describe("parseEnv", () => {
  it("returns parsed values with defaults", () => {
    const env = parseEnv(
      clientEnvSchema,
      { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" },
      "client",
    );
    expect(env.NEXT_PUBLIC_GOOGLE_AUTH).toBe("0");
  });

  it("names every missing variable in one error", () => {
    expect(() => parseEnv(serverEnvSchema, {}, "server")).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY.*APP_URL|APP_URL.*SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("treats empty optional mail variables as unset", () => {
    const base = { SUPABASE_SERVICE_ROLE_KEY: "k", APP_URL: "http://localhost:3120" };
    const env = parseEnv(
      serverEnvSchema,
      { ...base, BREVO_API_KEY: "", EMAIL_FROM_ADDRESS: "", EMAIL_FROM_NAME: "" },
      "server",
    );
    expect(env.BREVO_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM_ADDRESS).toBeUndefined();
    expect(env.EMAIL_FROM_NAME).toBeUndefined();
  });

  it("rejects an invalid EMAIL_FROM_ADDRESS", () => {
    const base = { SUPABASE_SERVICE_ROLE_KEY: "k", APP_URL: "http://localhost:3120" };
    expect(() =>
      parseEnv(serverEnvSchema, { ...base, EMAIL_FROM_ADDRESS: "not-an-email" }, "server"),
    ).toThrow(/EMAIL_FROM_ADDRESS/);
  });

  it("treats empty Stripe variables as unset and rejects the wrong key type", () => {
    const base = { SUPABASE_SERVICE_ROLE_KEY: "k", APP_URL: "http://localhost:3120" };
    const env = parseEnv(
      serverEnvSchema,
      { ...base, STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "" },
      "server",
    );
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.STRIPE_WEBHOOK_SECRET).toBeUndefined();
    expect(() =>
      parseEnv(serverEnvSchema, { ...base, STRIPE_SECRET_KEY: "pk_test_abc" }, "server"),
    ).toThrow(/STRIPE_SECRET_KEY/);
    expect(() =>
      parseEnv(serverEnvSchema, { ...base, STRIPE_WEBHOOK_SECRET: "abc" }, "server"),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
    const ok = parseEnv(
      serverEnvSchema,
      { ...base, STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_abc" },
      "server",
    );
    expect(ok.STRIPE_SECRET_KEY).toBe("sk_test_abc");
  });
});
