import { describe, expect, it } from "vitest";
import { decideAuthRedirect, safeNext } from "./auth-redirect";

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
});
