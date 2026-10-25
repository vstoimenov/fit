import { describe, expect, it } from "vitest";
import { devLoginAccount, devLoginAllowed } from "./dev-login";

const local = {
  nodeEnv: "development",
  supabaseUrl: "http://127.0.0.1:55321",
  host: "localhost:3120",
};

describe("devLoginAllowed", () => {
  it("allows a dev server on localhost with a local database", () => {
    expect(devLoginAllowed(local)).toBe(true);
    expect(devLoginAllowed({ ...local, host: "127.0.0.1:3120" })).toBe(true);
    expect(devLoginAllowed({ ...local, supabaseUrl: "http://localhost:54321" })).toBe(true);
  });

  it("refuses production and test builds", () => {
    expect(devLoginAllowed({ ...local, nodeEnv: "production" })).toBe(false);
    expect(devLoginAllowed({ ...local, nodeEnv: "test" })).toBe(false);
    expect(devLoginAllowed({ ...local, nodeEnv: undefined })).toBe(false);
  });

  it("refuses a hosted database", () => {
    expect(devLoginAllowed({ ...local, supabaseUrl: "https://abc.supabase.co" })).toBe(false);
    expect(devLoginAllowed({ ...local, supabaseUrl: "not a url" })).toBe(false);
  });

  it("refuses any host other than this computer", () => {
    expect(devLoginAllowed({ ...local, host: "iamstrong.bg" })).toBe(false);
    expect(devLoginAllowed({ ...local, host: "192.168.0.131:3120" })).toBe(false);
    expect(devLoginAllowed({ ...local, host: "localhost.evil.com" })).toBe(false);
    expect(devLoginAllowed({ ...local, host: null })).toBe(false);
  });
});

describe("devLoginAccount", () => {
  it("maps the two test roles to their accounts and start pages", () => {
    expect(devLoginAccount("client")).toEqual({ email: "klientka@example.test", next: "/app" });
    expect(devLoginAccount("admin")).toEqual({ email: "admin@example.test", next: "/admin" });
  });

  it("knows no other role", () => {
    expect(devLoginAccount("owner")).toBeNull();
    expect(devLoginAccount(null)).toBeNull();
  });
});
