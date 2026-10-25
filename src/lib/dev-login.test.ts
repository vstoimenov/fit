import { describe, expect, it } from "vitest";
import {
  devAutoLoginTarget,
  devLoginAccount,
  devLoginAllowed,
  shareLoginAllowed,
} from "./dev-login";

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

describe("shareLoginAllowed", () => {
  it("allows exactly the configured share host", () => {
    expect(
      shareLoginAllowed({
        shareHost: "abc-def.trycloudflare.com",
        host: "abc-def.trycloudflare.com",
      }),
    ).toBe(true);
  });

  it("refuses when no share host is configured or the host differs", () => {
    expect(shareLoginAllowed({ shareHost: undefined, host: "abc-def.trycloudflare.com" })).toBe(
      false,
    );
    expect(shareLoginAllowed({ shareHost: "", host: "" })).toBe(false);
    expect(
      shareLoginAllowed({ shareHost: "abc-def.trycloudflare.com", host: "iamstrong.bg" }),
    ).toBe(false);
    expect(
      shareLoginAllowed({
        shareHost: "abc-def.trycloudflare.com",
        host: "evil-abc-def.trycloudflare.com",
      }),
    ).toBe(false);
    expect(shareLoginAllowed({ shareHost: "abc-def.trycloudflare.com", host: null })).toBe(false);
  });
});

describe("devAutoLoginTarget", () => {
  it("sends a signed-out visit of the app to the client sign-in, keeping the page", () => {
    expect(devAutoLoginTarget("/app", "")).toBe("/dev/login?as=client&next=%2Fapp");
    expect(devAutoLoginTarget("/app/nutrition", "?view=menu")).toBe(
      "/dev/login?as=client&next=%2Fapp%2Fnutrition%3Fview%3Dmenu",
    );
  });

  it("sends the admin panel to the admin sign-in", () => {
    expect(devAutoLoginTarget("/admin/meals", "")).toBe(
      "/dev/login?as=admin&next=%2Fadmin%2Fmeals",
    );
  });

  it("leaves public pages alone", () => {
    expect(devAutoLoginTarget("/", "")).toBeNull();
    expect(devAutoLoginTarget("/login", "")).toBeNull();
    expect(devAutoLoginTarget("/application", "")).toBeNull();
    expect(devAutoLoginTarget("/administrator", "")).toBeNull();
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
