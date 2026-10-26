import { describe, expect, it } from "vitest";
import { decideAuthRedirect, emailLinkType, safeNext } from "./auth-redirect";

describe("decideAuthRedirect", () => {
  it("sends signed-out visitors of /app and /admin to login with a return path", () => {
    expect(
      decideAuthRedirect({ pathname: "/app/library", search: "?level=pro", hasSession: false }),
    ).toBe("/login?next=%2Fapp%2Flibrary%3Flevel%3Dpro");
    expect(decideAuthRedirect({ pathname: "/admin", search: "", hasSession: false })).toBe(
      "/login?next=%2Fadmin",
    );
  });

  it("sends signed-in visitors of /login to the app", () => {
    expect(decideAuthRedirect({ pathname: "/login", search: "", hasSession: true })).toBe("/app");
  });

  it("sends signed-in visitors of the marketing pages to the app", () => {
    expect(decideAuthRedirect({ pathname: "/", search: "", hasSession: true })).toBe("/app");
    expect(decideAuthRedirect({ pathname: "/landing", search: "?utm=x", hasSession: true })).toBe(
      "/app",
    );
    expect(decideAuthRedirect({ pathname: "/podari", search: "", hasSession: true })).toBeNull();
    expect(decideAuthRedirect({ pathname: "/", search: "", hasSession: false })).toBeNull();
  });

  it("leaves everything else alone", () => {
    expect(decideAuthRedirect({ pathname: "/", search: "", hasSession: false })).toBeNull();
    expect(decideAuthRedirect({ pathname: "/start", search: "", hasSession: true })).toBeNull();
    expect(
      decideAuthRedirect({ pathname: "/application", search: "", hasSession: false }),
    ).toBeNull();
  });
});

describe("safeNext", () => {
  it("keeps same-site paths and rejects everything else", () => {
    expect(safeNext("/app/plan")).toBe("/app/plan");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext(null, "/start/finish")).toBe("/start/finish");
  });

  it("rejects control-character and scheme bypasses", () => {
    expect(safeNext("/\t/evil.com")).toBe("/app");
    expect(safeNext("/\n/evil.com")).toBe("/app");
    expect(safeNext("/\r//evil.com")).toBe("/app");
    expect(safeNext("javascript:alert(1)")).toBe("/app");
    expect(safeNext("")).toBe("/app");
  });

  it("rejects dot-segment paths that normalize into a protocol-relative URL", () => {
    expect(safeNext("/app/../..//evil.com")).toBe("/app");
    expect(safeNext("/..//evil.com")).toBe("/app");
    expect(safeNext("/a/..//evil.com")).toBe("/app");
    expect(safeNext("/./\\evil.com")).toBe("/app");
    expect(safeNext("/..\\/evil.com")).toBe("/app");
  });

  it("keeps encoded slashes as a same-site path", () => {
    const result = safeNext("/%2F%2Fevil.com");
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
  });

  it("keeps query and hash on same-site paths", () => {
    expect(safeNext("/app/plan?week=2#top")).toBe("/app/plan?week=2#top");
  });
});

describe("emailLinkType", () => {
  it("accepts the one-time e-mail link types Supabase issues", () => {
    for (const t of ["magiclink", "recovery", "invite", "email"]) expect(emailLinkType(t)).toBe(t);
  });

  it("rejects anything else", () => {
    for (const t of [null, "", "signup", "sms", "phone_change", "MAGICLINK", "magiclink "]) {
      expect(emailLinkType(t)).toBeNull();
    }
  });
});
