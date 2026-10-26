import { describe, expect, it } from "vitest";
import { foundersLive } from "./founders";

describe("foundersLive", () => {
  it("is true until the founders campaign closes on 21 November 2026 (Sofia time)", () => {
    expect(foundersLive(new Date("2026-11-21T23:00:00+02:00"))).toBe(true);
    expect(foundersLive(new Date("2026-11-22T00:00:01+02:00"))).toBe(false);
  });
});
