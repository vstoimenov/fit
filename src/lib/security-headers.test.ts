import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

const byKey = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));

describe("securityHeaders", () => {
  it("forbids framing, sniffing and unused device features", () => {
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(byKey["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(byKey["Content-Security-Policy"]).toContain("base-uri 'self'");
    expect(byKey["Permissions-Policy"]).toContain("microphone=()");
    expect(byKey["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("keeps the referrer the YouTube embeds need (origin only, cross-site)", () => {
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("does not restrict scripts, styles or frames (a full CSP is a separate, report-only step)", () => {
    expect(byKey["Content-Security-Policy"]).not.toMatch(
      /script-src|style-src|frame-src|default-src/,
    );
  });
});
