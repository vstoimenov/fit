import { describe, expect, it } from "vitest";
import { toLocalDate, weekStrip } from "./dates";

describe("toLocalDate", () => {
  it("uses the given timezone, not UTC", () => {
    expect(toLocalDate("2026-10-14T21:30:00Z", "Europe/Sofia")).toBe("2026-10-15");
    expect(toLocalDate("2026-10-14T21:30:00Z", "UTC")).toBe("2026-10-14");
  });
});

describe("weekStrip", () => {
  it("returns Monday..Sunday around today with done and slot flags", () => {
    // 2026-10-14 is a Wednesday.
    const week = weekStrip(
      "2026-10-14",
      ["2026-10-12", "2026-10-14"],
      ["2026-10-13", "2026-10-15"],
    );
    expect(week.map((d) => d.date)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(week.map((d) => d.label)).toEqual(["П", "В", "С", "Ч", "П", "С", "Н"]);
    expect(week[2]).toMatchObject({ isToday: true, done: true, slot: false });
    expect(week[1]).toMatchObject({ done: false, slot: true });
  });

  it("handles a Sunday as the last day of its week", () => {
    expect(weekStrip("2026-10-18", [], [])[6]).toMatchObject({ date: "2026-10-18", isToday: true });
  });
});
