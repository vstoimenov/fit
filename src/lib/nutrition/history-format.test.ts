import { describe, expect, it } from "vitest";
import { historyLabel } from "./history-format";

describe("historyLabel", () => {
  it("names the day and its calories, with a non-breaking space in thousands", () => {
    expect(historyLabel("2026-10-22", 1580, 3)).toBe("чт, 22 окт — 1\u00a0580 ккал");
  });
  it("says there are no entries when the day is empty", () => {
    expect(historyLabel("2026-10-22", 0, 0)).toBe("чт, 22 окт — няма записи");
  });
  it("shows small numbers and rounds", () => {
    expect(historyLabel("2026-10-05", 640.4, 1)).toBe("пн, 5 окт — 640 ккал");
  });
});
