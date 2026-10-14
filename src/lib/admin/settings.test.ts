import { describe, expect, it } from "vitest";
import { parseSetting, renderTemplate, SETTING_DEFAULTS, SETTINGS } from "./settings";

describe("settings", () => {
  it("falls back to defaults for missing or invalid values", () => {
    expect(parseSetting("risk", undefined)).toEqual(SETTING_DEFAULTS.risk);
    expect(parseSetting("risk", { inactiveDays: -1, minCompletionPct: 50 })).toEqual(
      SETTING_DEFAULTS.risk,
    );
    expect(parseSetting("risk", { inactiveDays: 7, minCompletionPct: 40 })).toEqual({
      inactiveDays: 7,
      minCompletionPct: 40,
    });
  });

  it("validates tracking ids", () => {
    expect(
      SETTINGS.tracking.safeParse({
        metaPixelId: "1234567890",
        ga4Id: "G-ABC1234",
        gtmId: "GTM-AB12CD",
        googleAdsId: "AW-123456789",
      }).success,
    ).toBe(true);
    expect(
      SETTINGS.tracking.safeParse({ metaPixelId: "abc", ga4Id: "", gtmId: "", googleAdsId: "" })
        .success,
    ).toBe(false);
  });

  it("renders template placeholders and leaves unknown ones visible", () => {
    expect(renderTemplate("Здравей, {{name}}! {{x}}", { name: "Ани" })).toBe("Здравей, Ани! {{x}}");
  });

  it("does not resolve inherited properties as placeholders", () => {
    expect(renderTemplate("{{toString}} {{__proto__}} {{constructor}}", {})).toBe(
      "{{toString}} {{__proto__}} {{constructor}}",
    );
  });
});
