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
});
