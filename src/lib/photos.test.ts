import { describe, expect, it } from "vitest";
import { FOCUS } from "@/lib/labels";
import { coverPhoto, PHOTOS } from "@/lib/photos";

describe("coverPhoto", () => {
  it("maps a known focus to its photo", () => {
    expect(coverPhoto("core").src).toBe("/photos/focus-core.jpg");
  });

  it("falls back to default for unknown or missing focus", () => {
    expect(coverPhoto("unknown").src).toBe("/photos/default.jpg");
    expect(coverPhoto(null).src).toBe("/photos/default.jpg");
    expect(coverPhoto(undefined).src).toBe("/photos/default.jpg");
    expect(coverPhoto("unknown").alt).toBe("Тренировка");
  });

  it("covers every FOCUS value with a Bulgarian alt text", () => {
    for (const focus of FOCUS) {
      const photo = coverPhoto(focus);
      expect(photo.src).toBe(`/photos/focus-${focus}.jpg`);
      expect(photo.alt).toMatch(/[Ѐ-ӿ]/);
    }
  });

  it("exposes the static photos", () => {
    for (const key of ["hero", "step1", "step2", "step3", "welcome"] as const) {
      expect(PHOTOS[key].src).toMatch(/^\/photos\/.+\.jpg$/);
      expect(PHOTOS[key].alt.length).toBeGreaterThan(0);
    }
  });
});
