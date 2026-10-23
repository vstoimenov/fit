import { describe, expect, it } from "vitest";
import { defaultBefore } from "./pair";

describe("defaultBefore", () => {
  it("returns null when there are no candidates", () => {
    expect(defaultBefore([])).toBeNull();
  });

  it("picks the earliest day", () => {
    expect(
      defaultBefore([
        { id: "b", takenOn: "2026-09-01" },
        { id: "a", takenOn: "2026-08-15" },
        { id: "c", takenOn: "2026-10-01" },
      ]),
    ).toBe("a");
  });

  it("returns the first one in input order when days tie", () => {
    expect(
      defaultBefore([
        { id: "x", takenOn: "2026-08-15" },
        { id: "y", takenOn: "2026-08-15" },
        { id: "z", takenOn: "2026-09-01" },
      ]),
    ).toBe("x");
  });

  it("handles a single candidate", () => {
    expect(defaultBefore([{ id: "only", takenOn: "2026-10-01" }])).toBe("only");
  });
});
