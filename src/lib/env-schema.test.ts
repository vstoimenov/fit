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

  it("requires a lead salt of at least 16 characters and digits for the Brevo list id", () => {
    const base = { SUPABASE_SERVICE_ROLE_KEY: "k", APP_URL: "http://localhost:3120" };
    expect(() => parseEnv(serverEnvSchema, { ...base, LEADS_SALT: "short" }, "server")).toThrow(
      /LEADS_SALT/,
    );
    expect(() =>
      parseEnv(
        serverEnvSchema,
        { ...base, LEADS_SALT: "0123456789abcdef", BREVO_LEADS_LIST_ID: "abc" },
        "server",
      ),
    ).toThrow(/BREVO_LEADS_LIST_ID/);
    const env = parseEnv(
      serverEnvSchema,
      { ...base, LEADS_SALT: "0123456789abcdef", BREVO_LEADS_LIST_ID: "12" },
      "server",
    );
    expect(env.BREVO_LEADS_LIST_ID).toBe("12");
  });

  it("treats empty optional mail variables as unset", () => {
    const base = {
      SUPABASE_SERVICE_ROLE_KEY: "k",
      APP_URL: "http://localhost:3120",
      LEADS_SALT: "0123456789abcdef",
    };
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
    const base = {
      SUPABASE_SERVICE_ROLE_KEY: "k",
      APP_URL: "http://localhost:3120",
      LEADS_SALT: "0123456789abcdef",
    };
    expect(() =>
      parseEnv(serverEnvSchema, { ...base, EMAIL_FROM_ADDRESS: "not-an-email" }, "server"),
    ).toThrow(/EMAIL_FROM_ADDRESS/);
  });

  it("treats empty Stripe variables as unset and rejects the wrong key type", () => {
    const base = {
      SUPABASE_SERVICE_ROLE_KEY: "k",
      APP_URL: "http://localhost:3120",
      LEADS_SALT: "0123456789abcdef",
    };
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

  it("trims whitespace around Stripe values pasted into the env", () => {
    const base = {
      SUPABASE_SERVICE_ROLE_KEY: "k",
      APP_URL: "http://localhost:3120",
      LEADS_SALT: "0123456789abcdef",
    };
    const env = parseEnv(
      serverEnvSchema,
      { ...base, STRIPE_SECRET_KEY: " sk_test_abc\n", STRIPE_WEBHOOK_SECRET: "  whsec_abc " },
      "server",
    );
    expect(env.STRIPE_SECRET_KEY).toBe("sk_test_abc");
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("whsec_abc");
    const blank = parseEnv(serverEnvSchema, { ...base, STRIPE_SECRET_KEY: "  " }, "server");
    expect(blank.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("treats empty Anthropic variables as unset and rejects a key without the sk-ant- prefix", () => {
    const base = {
      SUPABASE_SERVICE_ROLE_KEY: "k",
      APP_URL: "http://localhost:3120",
      LEADS_SALT: "0123456789abcdef",
    };
    const env = parseEnv(
      serverEnvSchema,
      { ...base, ANTHROPIC_API_KEY: " \n", NUTRITION_AI_MODEL: "" },
      "server",
    );
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.NUTRITION_AI_MODEL).toBeUndefined();
    expect(() =>
      parseEnv(serverEnvSchema, { ...base, ANTHROPIC_API_KEY: "abc" }, "server"),
    ).toThrow(/ANTHROPIC_API_KEY/);
    const ok = parseEnv(
      serverEnvSchema,
      { ...base, ANTHROPIC_API_KEY: "sk-ant-abc\n", NUTRITION_AI_MODEL: "claude-haiku-5-5" },
      "server",
    );
    expect(ok.ANTHROPIC_API_KEY).toBe("sk-ant-abc");
    expect(ok.NUTRITION_AI_MODEL).toBe("claude-haiku-5-5");
  });
});
