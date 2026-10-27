import { describe, expect, it } from "vitest";
import { ICON_VERSION, iconUrl, iconVariant } from "./icon-variant";

describe("iconVariant", () => {
  it("is admin only for the exact value and member otherwise", () => {
    expect(iconVariant("admin")).toBe("admin");
    expect(iconVariant("member")).toBe("member");
    expect(iconVariant(null)).toBe("member");
    expect(iconVariant("ADMIN")).toBe("member");
    expect(iconVariant("admin; drop")).toBe("member");
  });
});

describe("iconUrl", () => {
  it("carries the design version and the admin variant only when asked", () => {
    expect(iconUrl(180)).toBe(`/pwa-icon/180?v=${ICON_VERSION}`);
    expect(iconUrl(512, "admin")).toBe(`/pwa-icon/512?v=${ICON_VERSION}&variant=admin`);
  });
});
