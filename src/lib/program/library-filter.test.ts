import { describe, expect, it } from "vitest";
import type { WorkoutSummary } from "@/server/content/today";
import { filterLibrary, parseLibraryFilter } from "./library-filter";

const w = (over: Partial<WorkoutSummary>): WorkoutSummary => ({
  id: crypto.randomUUID(),
  title: "t",
  description: "",
  kind: "regular",
  level: "beginner",
  durationMin: 20,
  focus: ["core"],
  thumbnailUrl: null,
  publishAt: "2026-10-01T00:00:00Z",
  starterOrder: null,
  minMemberLevel: null,
  ...over,
});

describe("parseLibraryFilter", () => {
  it("keeps only known values", () => {
    expect(parseLibraryFilter({ length: "short", focus: "core" })).toEqual({
      length: "short",
      focus: "core",
    });
    expect(
      parseLibraryFilter({ level: "god", length: ["mid", "long"], focus: "<script>" }),
    ).toEqual({});
  });
});

describe("parseLibraryFilter level", () => {
  it("ignores an old ?level= link: the library is always the member's own level", () => {
    expect(parseLibraryFilter({ level: "pro" })).not.toHaveProperty("level");
    expect(parseLibraryFilter({ level: "pro", length: "mid" })).toEqual({ length: "mid" });
  });
});

describe("filterLibrary", () => {
  const all = [
    w({ id: "a", level: "beginner", durationMin: 15, focus: ["core"] }),
    w({ id: "b", level: "pro", durationMin: 40, focus: ["cardio"] }),
    w({ id: "c", kind: "starter", level: null, durationMin: 25, focus: ["stretch"] }),
  ];

  it("filters by length and focus together", () => {
    expect(filterLibrary(all, { length: "short" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterLibrary(all, { length: "long" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterLibrary(all, { length: "mid", focus: "stretch" }).map((x) => x.id)).toEqual(["c"]);
  });

  it("returns everything with no filter", () => {
    expect(filterLibrary(all, {})).toHaveLength(3);
  });
});
