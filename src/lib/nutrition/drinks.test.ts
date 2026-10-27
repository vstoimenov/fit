import { describe, expect, it } from "vitest";
import { DRINK_PRESETS } from "./drinks";

describe("DRINK_PRESETS", () => {
  it("lists the common drinks with a portion in ml and its calories", () => {
    const names = DRINK_PRESETS.map((d) => d.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Кафе с мляко",
        "Капучино",
        "Портокалов фреш",
        "Кола",
        "Бира",
        "Вино",
      ]),
    );
    expect(new Set(names).size).toBe(names.length);
    for (const d of DRINK_PRESETS) {
      expect(d.grams).toBeGreaterThanOrEqual(20);
      expect(d.grams).toBeLessThanOrEqual(600);
      expect(d.kcal).toBeGreaterThanOrEqual(0);
      expect(d.kcal).toBeLessThan(400);
    }
  });

  it("keeps kcal consistent with the macros, except alcohol (7 kcal per g on top)", () => {
    for (const d of DRINK_PRESETS) {
      const fromMacros = 4 * d.proteinG + 4 * d.carbsG + 9 * d.fatG;
      if (d.alcohol) expect(d.kcal).toBeGreaterThan(fromMacros);
      else expect(Math.abs(d.kcal - fromMacros)).toBeLessThanOrEqual(Math.max(5, d.kcal * 0.1));
    }
  });
});
