import { describe, expect, it } from "vitest";
import { classifyWriteError, workoutInputSchema } from "./workouts";

describe("classifyWriteError", () => {
  it("tells the single-free index from the starter-order index", () => {
    expect(
      classifyWriteError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "workouts_single_free"',
      }),
    ).toBe("free");
    expect(
      classifyWriteError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "workouts_starter_order"',
      }),
    ).toBe("starter_order");
    expect(
      classifyWriteError({
        code: "23505",
        message: "duplicate key",
        details: "Key (starter_order)=(7) already exists. workouts_starter_order",
      }),
    ).toBe("starter_order");
  });

  it("flags a thumbnail check violation and ignores the rest", () => {
    expect(
      classifyWriteError({
        code: "23514",
        message:
          'new row for relation "workouts" violates check constraint "workouts_thumbnail_url_check"',
      }),
    ).toBe("thumbnail");
    expect(
      classifyWriteError({
        code: "23514",
        message: 'violates check constraint "workouts_level_rule"',
      }),
    ).toBeNull();
    expect(
      classifyWriteError({ code: "23505", message: 'unique constraint "something_else"' }),
    ).toBeNull();
    expect(classifyWriteError({ code: "42501", message: "denied" })).toBeNull();
    expect(classifyWriteError(null)).toBeNull();
  });
});

describe("workoutInputSchema minMemberLevel", () => {
  const base = {
    title: "Ексклузивна",
    description: "",
    kind: "regular",
    level: "beginner",
    durationMin: 20,
    focus: [],
    videoUrl: "https://youtu.be/ml6cT4AZdqI",
    publishAt: null,
    notify: false,
  };

  it("defaults to everyone and accepts 2 to 10", () => {
    expect(workoutInputSchema.parse(base).minMemberLevel).toBeNull();
    expect(workoutInputSchema.parse({ ...base, minMemberLevel: null }).minMemberLevel).toBeNull();
    for (const n of [2, 6, 10]) {
      expect(workoutInputSchema.parse({ ...base, minMemberLevel: n }).minMemberLevel).toBe(n);
    }
  });

  it.each([0, 1, 11, 2.5, -3, Number.NaN, "6"])("rejects %s", (value) => {
    expect(workoutInputSchema.safeParse({ ...base, minMemberLevel: value }).success).toBe(false);
  });
});
