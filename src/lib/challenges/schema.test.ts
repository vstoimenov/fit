import { describe, expect, it } from "vitest";
import { challengeInputSchema } from "./schema";

const WORKOUT_ID = "3f2b7c1e-9a4d-4e8b-8c2a-1d5f6e7a8b9c";

function input(overrides: Record<string, unknown> = {}) {
  return {
    title: "Първите 14 дни",
    description: "Описание",
    startDate: "2026-11-01",
    days: 3,
    published: true,
    tasks: [
      { task: "Първа задача", workoutId: null },
      { task: "Втора задача", workoutId: WORKOUT_ID },
      { task: "Трета задача", workoutId: null },
    ],
    ...overrides,
  };
}

function issuePaths(result: { success: false; error: { issues: { path: PropertyKey[] }[] } }) {
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("challengeInputSchema", () => {
  it("accepts a valid challenge", () => {
    const result = challengeInputSchema.safeParse(input());
    expect(result.success).toBe(true);
  });

  it("trims the title and the task texts", () => {
    const result = challengeInputSchema.parse(
      input({
        title: "  Първите 14 дни  ",
        tasks: [
          { task: "  Пий вода ", workoutId: null },
          { task: "a", workoutId: null },
          { task: "b", workoutId: null },
        ],
      }),
    );
    expect(result.title).toBe("Първите 14 дни");
    expect(result.tasks[0]?.task).toBe("Пий вода");
  });

  it("defaults a missing description to an empty string", () => {
    const rest: Record<string, unknown> = input();
    delete rest.description;
    expect(challengeInputSchema.parse(rest).description).toBe("");
  });

  it("bounds the title to 3..80 characters after trimming", () => {
    expect(challengeInputSchema.safeParse(input({ title: "  ab  " })).success).toBe(false);
    expect(challengeInputSchema.safeParse(input({ title: "abc" })).success).toBe(true);
    expect(challengeInputSchema.safeParse(input({ title: "a".repeat(80) })).success).toBe(true);
    expect(challengeInputSchema.safeParse(input({ title: "a".repeat(81) })).success).toBe(false);
  });

  it("bounds the description to 4 000 characters", () => {
    expect(challengeInputSchema.safeParse(input({ description: "x".repeat(4000) })).success).toBe(
      true,
    );
    expect(challengeInputSchema.safeParse(input({ description: "x".repeat(4001) })).success).toBe(
      false,
    );
  });

  it("requires a real start date on or after 2026-01-01", () => {
    expect(challengeInputSchema.safeParse(input({ startDate: "2026-01-01" })).success).toBe(true);
    expect(challengeInputSchema.safeParse(input({ startDate: "2025-12-31" })).success).toBe(false);
    expect(challengeInputSchema.safeParse(input({ startDate: "2026-02-30" })).success).toBe(false);
    expect(challengeInputSchema.safeParse(input({ startDate: "01.11.2026" })).success).toBe(false);
  });

  it("bounds the number of days to 3..60 whole days", () => {
    const tasks = (n: number) =>
      Array.from({ length: n }, () => ({ task: "Задача", workoutId: null }));
    expect(challengeInputSchema.safeParse(input({ days: 2, tasks: tasks(2) })).success).toBe(false);
    expect(challengeInputSchema.safeParse(input({ days: 3, tasks: tasks(3) })).success).toBe(true);
    expect(challengeInputSchema.safeParse(input({ days: 60, tasks: tasks(60) })).success).toBe(
      true,
    );
    expect(challengeInputSchema.safeParse(input({ days: 61, tasks: tasks(61) })).success).toBe(
      false,
    );
    expect(challengeInputSchema.safeParse(input({ days: 3.5, tasks: tasks(3) })).success).toBe(
      false,
    );
  });

  it("requires exactly one task per day", () => {
    const short = challengeInputSchema.safeParse(input({ days: 14, tasks: input().tasks }));
    expect(short.success).toBe(false);
    if (!short.success) expect(issuePaths(short)).toContain("tasks");

    const long = challengeInputSchema.safeParse(
      input({ days: 3, tasks: [...input().tasks, { task: "Четвърта", workoutId: null }] }),
    );
    expect(long.success).toBe(false);
  });

  it("bounds each task text to 1..200 characters", () => {
    const withTask = (task: string) =>
      input({
        tasks: [
          { task, workoutId: null },
          { task: "b", workoutId: null },
          { task: "c", workoutId: null },
        ],
      });
    expect(challengeInputSchema.safeParse(withTask("   ")).success).toBe(false);
    expect(challengeInputSchema.safeParse(withTask("x".repeat(200))).success).toBe(true);
    expect(challengeInputSchema.safeParse(withTask("x".repeat(201))).success).toBe(false);
  });

  it("accepts a workout id or null per day, and rejects other values", () => {
    const withWorkout = (workoutId: unknown) =>
      input({
        tasks: [
          { task: "a", workoutId },
          { task: "b", workoutId: null },
          { task: "c", workoutId: null },
        ],
      });
    expect(challengeInputSchema.safeParse(withWorkout(null)).success).toBe(true);
    expect(challengeInputSchema.safeParse(withWorkout(WORKOUT_ID)).success).toBe(true);
    expect(challengeInputSchema.safeParse(withWorkout("not-a-uuid")).success).toBe(false);
  });

  it("requires a published flag", () => {
    const rest: Record<string, unknown> = input();
    delete rest.published;
    expect(challengeInputSchema.safeParse(rest).success).toBe(false);
  });
});
