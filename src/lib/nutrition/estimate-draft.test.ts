import { describe, expect, it } from "vitest";
import { applyGrams, draftTotals, gramsProblem, parseGramsInput } from "./estimate-draft";
import type { EstimateItem } from "./schema";

const bread: EstimateItem = {
  name: "Хляб",
  grams: 60,
  kcal: 150,
  proteinG: 5,
  carbsG: 28,
  fatG: 2,
};
const salad: EstimateItem = {
  name: "Пилешка салата",
  grams: 250,
  kcal: 300,
  proteinG: 30,
  carbsG: 10,
  fatG: 15.5,
};

describe("draftTotals", () => {
  it("sums kcal and macros of the draft rows", () => {
    expect(draftTotals([bread, salad])).toEqual({
      kcal: 450,
      proteinG: 35,
      carbsG: 38,
      fatG: 17.5,
    });
  });

  it("is zero for no rows", () => {
    expect(draftTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe("applyGrams", () => {
  it("rescales only the chosen row and returns a new array", () => {
    const rows = [bread, salad];
    const next = applyGrams(rows, 0, 120);
    expect(next).not.toBe(rows);
    expect(next[0]).toEqual({
      name: "Хляб",
      grams: 120,
      kcal: 300,
      proteinG: 10,
      carbsG: 56,
      fatG: 4,
    });
    expect(next[1]).toBe(salad);
    expect(rows[0]).toBe(bread); // input untouched
  });

  it("keeps the row unchanged for grams outside 1–2000 or not a number", () => {
    for (const grams of [0, 0.5, -10, 2001, Number.NaN, Number.POSITIVE_INFINITY]) {
      const next = applyGrams([bread, salad], 0, grams);
      expect(next[0]).toBe(bread);
    }
  });

  it("keeps the row when the scaled values would not fit the diary", () => {
    const dense: EstimateItem = {
      name: "Масло",
      grams: 10,
      kcal: 74,
      proteinG: 0,
      carbsG: 0,
      fatG: 8,
    };
    // 2000 g of it would be 14 800 kcal
    expect(applyGrams([dense], 0, 2000)[0]).toBe(dense);
  });

  it("ignores an index that is not a row", () => {
    expect(applyGrams([bread], 3, 100)).toEqual([bread]);
    expect(applyGrams([bread], -1, 100)).toEqual([bread]);
  });

  it("scales from the original estimate when given, so typing „150“ does not compound rounding", () => {
    const base = [bread];
    let rows = base;
    for (const grams of [1, 15, 150]) rows = applyGrams(rows, 0, grams, base);
    expect(rows[0]).toEqual(applyGrams(base, 0, 150)[0]);
    expect(rows[0]).toEqual({
      name: "Хляб",
      grams: 150,
      kcal: 375,
      proteinG: 12.5,
      carbsG: 70,
      fatG: 5,
    });
    // scaling from the previous row instead: the 1 g step rounds 2.5 kcal up to 3 and the error grows x50
    let chained = base;
    for (const grams of [1, 15, 150]) chained = applyGrams(chained, 0, grams);
    expect(chained[0]?.kcal).not.toBe(375);
  });

  it("keeps the previous row (not the original) when the new amount is invalid", () => {
    const base = [bread];
    const first = applyGrams(base, 0, 90, base);
    const second = applyGrams(first, 0, 5000, base);
    expect(second[0]).toBe(first[0]);
  });
});

describe("parseGramsInput", () => {
  it("accepts whole and decimal amounts with a dot or comma", () => {
    expect(parseGramsInput("150")).toBe(150);
    expect(parseGramsInput(" 150,5 ")).toBe(150.5);
    expect(parseGramsInput("0.5")).toBe(0.5);
  });

  it("returns null for anything else", () => {
    for (const raw of ["", "  ", "abc", "12 г", "1e3x", "Infinity", "NaN"]) {
      expect(parseGramsInput(raw)).toBeNull();
    }
  });
});

describe("gramsProblem", () => {
  it("is null for an amount the row can take", () => {
    expect(gramsProblem(bread, "90")).toBeNull();
    expect(gramsProblem(bread, "2000")).toBeNull();
  });

  it("explains an amount that is not 1–2000 g", () => {
    for (const raw of ["", "abc", "0", "0,5", "2001"]) {
      expect(gramsProblem(bread, raw)).toBe("Количеството е между 1 и 2000 г.");
    }
  });

  it("explains an amount that is in range but too large to save", () => {
    const dense: EstimateItem = {
      name: "Масло",
      grams: 10,
      kcal: 74,
      proteinG: 0,
      carbsG: 0,
      fatG: 8,
    };
    expect(gramsProblem(dense, "2000")).toBe("Това количество е твърде голямо.");
  });
});
