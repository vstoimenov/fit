import { afterEach, describe, expect, it, vi } from "vitest";
import { clientEnvSchema, parseEnv, serverEnvSchema } from "./env-schema";

describe("parseEnv", () => {
  afterEach(() => vi.restoreAllMocks());

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
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const dropped = parseEnv(
      serverEnvSchema,
      { ...base, LEADS_SALT: "0123456789abcdef", BREVO_LEADS_LIST_ID: "abc" },
      "server",
    );
    expect(dropped.BREVO_LEADS_LIST_ID).toBeUndefined();
    expect(String(warn.mock.calls[0]?.[0])).toContain("BREVO_LEADS_LIST_ID");
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

  it("drops an invalid EMAIL_FROM_ADDRESS with a warning instead of failing the boot", () => {
    const base = {
      SUPABASE_SERVICE_ROLE_KEY: "k",
      APP_URL: "http://localhost:3120",
      LEADS_SALT: "0123456789abcdef",
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = parseEnv(
      serverEnvSchema,
      { ...base, EMAIL_FROM_ADDRESS: "not-an-email" },
      "server",
    );
    expect(env.EMAIL_FROM_ADDRESS).toBeUndefined();
    expect(String(warn.mock.calls[0]?.[0])).toContain("EMAIL_FROM_ADDRESS");
  });

  it("treats empty Stripe variables as unset and drops the wrong key type with a warning", () => {
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
    // A wrong optional key must not take the whole site down: it is ignored and named in a warning.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const wrong = parseEnv(
      serverEnvSchema,
      { ...base, STRIPE_SECRET_KEY: "pk_test_abc", STRIPE_WEBHOOK_SECRET: "abc" },
      "server",
    );
    expect(wrong.STRIPE_SECRET_KEY).toBeUndefined();
    expect(wrong.STRIPE_WEBHOOK_SECRET).toBeUndefined();
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([
      expect.stringContaining("STRIPE_SECRET_KEY"),
      expect.stringContaining("STRIPE_WEBHOOK_SECRET"),
    ]);
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

  it("treats empty Anthropic variables as unset and drops a key without the sk-ant- prefix", () => {
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
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const placeholder = parseEnv(
      serverEnvSchema,
      { ...base, ANTHROPIC_API_KEY: "КЛЮЧЪТ" },
      "server",
    );
    expect(placeholder.ANTHROPIC_API_KEY).toBeUndefined();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/ANTHROPIC_API_KEY.*sk-ant-/);
    const ok = parseEnv(
      serverEnvSchema,
      { ...base, ANTHROPIC_API_KEY: "sk-ant-abc\n", NUTRITION_AI_MODEL: "claude-haiku-5-5" },
      "server",
    );
    expect(ok.ANTHROPIC_API_KEY).toBe("sk-ant-abc");
    expect(ok.NUTRITION_AI_MODEL).toBe("claude-haiku-5-5");
  });
});
