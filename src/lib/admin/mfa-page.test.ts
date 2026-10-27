import { describe, expect, it } from "vitest";
import { mfaPageDecision } from "./mfa-page";

describe("mfaPageDecision", () => {
  it("sends a non-admin away", () => {
    expect(mfaPageDecision({ access: "not_admin", aal: "aal1", enrol: false })).toBe("not_found");
  });

  it("shows the form while the second factor is required", () => {
    expect(mfaPageDecision({ access: "mfa_required", aal: "aal1", enrol: false })).toBe("form");
  });

  it("sends an already verified session to the admin", () => {
    expect(mfaPageDecision({ access: "ok", aal: "aal2", enrol: false })).toBe("admin");
    expect(mfaPageDecision({ access: "ok", aal: "aal2", enrol: true })).toBe("admin");
  });

  it("with the test-mode flag off, goes to the admin unless she asked to enrol", () => {
    expect(mfaPageDecision({ access: "ok", aal: "aal1", enrol: false })).toBe("admin");
    expect(mfaPageDecision({ access: "ok", aal: "aal1", enrol: true })).toBe("form");
  });
});
