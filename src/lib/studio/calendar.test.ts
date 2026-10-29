import { describe, expect, it } from "vitest";
import { dayCellLabel, dayState, rollingGrid } from "./calendar";

describe("rollingGrid", () => {
  it("shows whole Monday-first weeks from this week until the booking window ends", () => {
    const weeks = rollingGrid("2026-10-29", 31);
    expect(weeks[0]).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    // Today + 30 = 28.11 (Saturday): the last week runs to Sunday 29.11.
    expect(weeks.at(-1)!.at(-1)).toBe("2026-11-29");
    expect(weeks).toHaveLength(5);
  });
});

describe("dayCellLabel", () => {
  it("names the month on its first day so the switch is visible", () => {
    expect(dayCellLabel("2026-11-01")).toBe("1 ное");
    expect(dayCellLabel("2026-11-02")).toBe("2");
  });
});

describe("dayState", () => {
  const s = (over: Partial<{ id: string; spotsLeft: number; cancelled: boolean }>) => ({
    id: "a",
    spotsLeft: 3,
    cancelled: false,
    ...over,
  });
  it("is empty without trainings", () => {
    expect(dayState([], [])).toBe("none");
  });
  it("marks her own booking first", () => {
    expect(dayState([s({ spotsLeft: 0 })], ["a"])).toBe("mine");
  });
  it("is open while any training has a spot", () => {
    expect(dayState([s({ spotsLeft: 0 }), s({ id: "b", spotsLeft: 2 })], [])).toBe("open");
  });
  it("is full when no spot is left", () => {
    expect(dayState([s({ spotsLeft: 0 }), s({ id: "b", cancelled: true })], [])).toBe("full");
  });
  it("is cancelled when every training is off", () => {
    expect(dayState([s({ cancelled: true })], [])).toBe("cancelled");
  });
});
