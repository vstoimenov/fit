import { describe, expect, it } from "vitest";
import { checkInSchema } from "./check-in-schema";

describe("checkInSchema", () => {
  it("parses form strings into numbers and drops blanks", () => {
    expect(
      checkInSchema.parse({
        weight_kg: "64,5",
        waist_cm: "",
        hips_cm: "",
        energy: "4",
        mood: "",
        note: "",
      }),
    ).toEqual({
      weight_kg: 64.5,
      energy: 4,
    });
  });

  it("rejects a completely empty check-in", () => {
    expect(
      checkInSchema.safeParse({
        weight_kg: "",
        waist_cm: "",
        hips_cm: "",
        energy: "",
        mood: "",
        note: " ",
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(checkInSchema.safeParse({ weight_kg: "500" }).success).toBe(false);
    expect(checkInSchema.safeParse({ energy: "7" }).success).toBe(false);
  });
});
