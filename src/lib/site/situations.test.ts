import { describe, expect, it } from "vitest";
import { SITUATIONS } from "./situations";

describe("SITUATIONS", () => {
  it("has the four situations with unique ids and full copy", () => {
    expect(SITUATIONS).toHaveLength(4);
    expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(4);
    expect(SITUATIONS.map((s) => s.id)).toEqual(["mother", "long-hours", "comeback", "first-time"]);
    for (const s of SITUATIONS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.day.length).toBeGreaterThan(0);
      expect(s.gets.length).toBeGreaterThan(0);
      expect(s.startsWith.length).toBeGreaterThan(0);
    }
  });
});
