import { describe, expect, it } from "vitest";
import {
  growRows,
  parseDays,
  templateRows,
  templateWouldOverwrite,
  type TaskRow,
} from "./task-rows";
import { FIRST_14_DAYS } from "./template";

function counter() {
  let n = 0;
  return () => `k${n++}`;
}

describe("parseDays", () => {
  it("accepts whole numbers 3..60 only", () => {
    expect(parseDays("3")).toBe(3);
    expect(parseDays("60")).toBe(60);
    expect(parseDays("2")).toBeNull();
    expect(parseDays("61")).toBeNull();
    expect(parseDays("")).toBeNull();
    expect(parseDays("1.5")).toBeNull();
    expect(parseDays("-4")).toBeNull();
  });
});

describe("growRows", () => {
  it("adds empty rows up to the day count", () => {
    const rows = growRows([], 3, counter());
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.task === "" && r.workoutId === "")).toBe(true);
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
  });

  it("never removes rows: 14 filled, down to 3, up to 30 restores the 14 and adds 16 empty", () => {
    const key = counter();
    let rows: TaskRow[] = growRows([], 14, key).map((r, i) => ({
      ...r,
      task: `Задача ${i + 1}`,
      workoutId: i === 5 ? "w-6" : "",
    }));
    rows = growRows(rows, 3, key); // shown = rows.slice(0, 3); the others stay in the stash
    expect(rows).toHaveLength(14);
    rows = growRows(rows, 30, key);
    expect(rows).toHaveLength(30);
    expect(rows.slice(0, 14).map((r) => r.task)).toEqual(
      Array.from({ length: 14 }, (_, i) => `Задача ${i + 1}`),
    );
    expect(rows[5].workoutId).toBe("w-6");
    expect(rows.slice(14).every((r) => r.task === "" && r.workoutId === "")).toBe(true);
    expect(new Set(rows.map((r) => r.key)).size).toBe(30);
  });
});

describe("templateRows", () => {
  it("fills days 1-14 with the template and keeps workouts already chosen for them", () => {
    const key = counter();
    const current = growRows([], 20, key).map((r, i) => ({
      ...r,
      task: "старо",
      workoutId: i === 3 || i === 17 ? `w-${i}` : "",
    }));
    const rows = templateRows(current, key);
    expect(rows).toHaveLength(20);
    expect(rows.slice(0, 14).map((r) => r.task)).toEqual(FIRST_14_DAYS);
    expect(rows[3].workoutId).toBe("w-3");
    // Days beyond 14 stay as they were (hidden once the count is 14).
    expect(rows[17]).toEqual(current[17]);
  });
});

describe("templateWouldOverwrite", () => {
  it("is false for empty rows and for text only beyond day 14", () => {
    const key = counter();
    const rows = growRows([], 20, key);
    expect(templateWouldOverwrite(rows)).toBe(false);
    expect(templateWouldOverwrite(rows.map((r, i) => (i === 15 ? { ...r, task: "x" } : r)))).toBe(
      false,
    );
  });

  it("is true when hidden days 4-14 hold text although the shown days 1-3 are empty", () => {
    const rows = growRows([], 14, counter()).map((r, i) => (i >= 3 ? { ...r, task: "скрито" } : r));
    expect(rows.slice(0, 3).every((r) => r.task === "")).toBe(true);
    expect(templateWouldOverwrite(rows)).toBe(true);
  });
});
