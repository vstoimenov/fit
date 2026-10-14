import { describe, expect, it } from "vitest";
import { levelGaps, monthGrid, weekOf, workoutStatus } from "./calendar";

describe("workoutStatus", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  it("classifies draft, scheduled and published", () => {
    expect(workoutStatus(null, now)).toBe("draft");
    expect(workoutStatus("2026-10-21T04:00:00Z", now)).toBe("scheduled");
    expect(workoutStatus("2026-10-20T10:00:00Z", now)).toBe("published");
  });
});

describe("monthGrid", () => {
  it("covers October 2026 in Monday-first weeks", () => {
    const grid = monthGrid(2026, 10);
    expect(grid[0]?.[0]).toBe("2026-09-28");
    expect(grid.at(-1)?.at(-1)).toBe("2026-11-01");
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat()).toContain("2026-10-31");
  });
});

describe("weekOf", () => {
  it("returns Monday..Sunday around a date", () => {
    expect(weekOf("2026-10-22")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });
});

describe("levelGaps", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  it("flags levels without regular content beyond the horizon", () => {
    const gaps = levelGaps(
      [
        { kind: "regular", level: "beginner", publishAt: "2026-10-30T04:00:00Z" },
        { kind: "regular", level: "advanced", publishAt: "2026-10-22T04:00:00Z" },
        { kind: "starter", level: null, publishAt: "2026-12-01T04:00:00Z" },
        { kind: "regular", level: "pro", publishAt: null },
      ],
      now,
      7,
    );
    expect(gaps).toEqual([
      { level: "advanced", lastAt: "2026-10-22T04:00:00Z" },
      { level: "pro", lastAt: null },
    ]);
  });

  it("orders timestamps by instant, not by string", () => {
    const gaps = levelGaps(
      [
        { kind: "regular", level: "beginner", publishAt: "2026-10-30T04:00:00Z" },
        { kind: "regular", level: "beginner", publishAt: "2026-10-22T04:00:00.000Z" },
        { kind: "regular", level: "advanced", publishAt: "2026-10-27T12:00:00Z" },
        { kind: "regular", level: "advanced", publishAt: "2026-10-27T14:00:00+05:00" },
        { kind: "regular", level: "pro", publishAt: "2026-11-30T04:00:00Z" },
      ],
      now,
      7,
    );
    expect(gaps).toEqual([]);
  });
});
