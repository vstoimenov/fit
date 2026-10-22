import { describe, expect, it } from "vitest";
import { buildRewardCandidates } from "./rewards";

const profile = (id: string, name = id) => ({ id, name, email: `${id}@example.test` });

describe("buildRewardCandidates", () => {
  it("keeps level 4+ members and sorts by level, then points", () => {
    const rows = buildRewardCandidates({
      totals: new Map([
        ["a", 230],
        ["b", 1000],
        ["c", 219],
        ["d", 980],
        ["e", 400],
      ]),
      profiles: ["a", "b", "c", "d", "e"].map((id) => profile(id)),
      given: [],
    });
    expect(rows.map((r) => [r.userId, r.level, r.points])).toEqual([
      ["b", 8, 1000],
      ["d", 8, 980],
      ["e", 5, 400],
      ["a", 4, 230],
    ]);
  });

  it("marks each reached reward level with its given date", () => {
    const [row] = buildRewardCandidates({
      totals: new Map([["a", 1600]]),
      profiles: [profile("a", "Мария")],
      given: [{ user_id: "a", level: 8, given_at: "2026-10-01T08:00:00Z" }],
    });
    expect(row.reached).toEqual([
      { level: 4, given: false, givenAt: null },
      { level: 8, given: true, givenAt: "2026-10-01T08:00:00Z" },
      { level: 10, given: false, givenAt: null },
    ]);
  });

  it("keeps a given reward above her level, marked as given, and offers no ungiven one above her level", () => {
    const [row] = buildRewardCandidates({
      totals: new Map([["a", 500]]),
      profiles: [profile("a")],
      given: [{ user_id: "a", level: 8, given_at: "2026-10-01T08:00:00Z" }],
    });
    expect(row.level).toBe(5);
    expect(row.reached).toEqual([
      { level: 4, given: false, givenAt: null },
      { level: 8, given: true, givenAt: "2026-10-01T08:00:00Z" },
    ]);
  });

  it("still lists a member below level 4, even with no points, once a reward was given", () => {
    const rows = buildRewardCandidates({
      totals: new Map(),
      profiles: [profile("a"), profile("b")],
      given: [{ user_id: "a", level: 4, given_at: "2026-10-01T08:00:00Z" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: "a", level: 1, points: 0 });
    expect(rows[0].reached).toEqual([{ level: 4, given: true, givenAt: "2026-10-01T08:00:00Z" }]);
  });

  it("skips members without a readable profile and falls back to the email when the name is empty", () => {
    const rows = buildRewardCandidates({
      totals: new Map([
        ["a", 300],
        ["ghost", 400],
      ]),
      profiles: [{ id: "a", name: "", email: "a@example.test" }],
      given: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("a@example.test");
  });
});
