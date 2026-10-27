import { describe, expect, it } from "vitest";
import {
  buildMenu,
  formatPortion,
  mealFits,
  nextCandidate,
  portionFactor,
  scalePortion,
  SLOT_PLANS,
  type MenuPrefs,
} from "./menu";
import type { Meal } from "./meal-schema";
import type { MealSlot } from "./labels";

let seq = 0;
function meal(over: Partial<Meal> & { mealTypes: MealSlot[] }): Meal {
  seq += 1;
  return {
    id: `m${seq}`,
    published: true,
    title: `Ястие ${seq}`,
    ingredients: [{ name: "Продукт", grams: 100 }],
    kcal: 500,
    proteinG: 20,
    carbsG: 50,
    fatG: 15,
    fitsVegetarian: false,
    fitsVegan: false,
    fitsPescatarian: false,
    allergens: [],
    steps: "",
    photoUrl: null,
    description: "",
    prepMin: null,
    cookMin: null,
    servings: 1,
    ...over,
  };
}

const omni: MenuPrefs = { diet: "omnivore", allergens: [], avoidFoods: "", mealsPerDay: 3 };

describe("SLOT_PLANS", () => {
  it("has the agreed slots and shares summing to 1", () => {
    for (const n of [3, 4, 5] as const) {
      const sum = SLOT_PLANS[n].reduce((s, p) => s + p.share, 0);
      expect(sum).toBeCloseTo(1, 10);
      expect(SLOT_PLANS[n]).toHaveLength(n);
    }
    expect(SLOT_PLANS[3].map((p) => p.meal)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(SLOT_PLANS[4].map((p) => p.meal)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    expect(SLOT_PLANS[5].map((p) => p.meal)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
      "snack",
    ]);
    expect(SLOT_PLANS[5].map((p) => p.share)).toEqual([0.2, 0.35, 0.25, 0.1, 0.1]);
  });
});

describe("mealFits", () => {
  const veganMeal = meal({
    mealTypes: ["lunch"],
    fitsVegan: true,
    fitsVegetarian: true,
    fitsPescatarian: true,
  });
  const vegMeal = meal({ mealTypes: ["lunch"], fitsVegetarian: true });
  const fishMeal = meal({ mealTypes: ["lunch"], fitsPescatarian: true });
  const meatMeal = meal({ mealTypes: ["lunch"] });

  it("applies the diet matrix", () => {
    expect(mealFits(vegMeal, { ...omni, diet: "vegan" })).toBe(false);
    expect(mealFits(veganMeal, { ...omni, diet: "vegan" })).toBe(true);
    expect(mealFits(meatMeal, { ...omni, diet: "vegan" })).toBe(false);
    expect(mealFits(vegMeal, { ...omni, diet: "vegetarian" })).toBe(true);
    expect(mealFits(fishMeal, { ...omni, diet: "vegetarian" })).toBe(false);
    expect(mealFits(veganMeal, { ...omni, diet: "pescatarian" })).toBe(true);
    expect(mealFits(vegMeal, { ...omni, diet: "pescatarian" })).toBe(true);
    expect(mealFits(fishMeal, { ...omni, diet: "pescatarian" })).toBe(true);
    expect(mealFits(meatMeal, { ...omni, diet: "pescatarian" })).toBe(false);
    for (const m of [veganMeal, vegMeal, fishMeal, meatMeal]) {
      expect(mealFits(m, omni)).toBe(true);
    }
  });

  it("rejects any shared allergen", () => {
    const m = meal({ mealTypes: ["lunch"], allergens: ["milk", "eggs"] });
    expect(mealFits(m, { ...omni, allergens: ["eggs"] })).toBe(false);
    expect(mealFits(m, { ...omni, allergens: ["fish", "milk"] })).toBe(false);
    expect(mealFits(m, { ...omni, allergens: ["fish"] })).toBe(true);
  });

  it("matches avoid words in the title and ingredient names, case-insensitive", () => {
    const m = meal({
      mealTypes: ["lunch"],
      title: "Ризото",
      ingredients: [{ name: "Гъби печурки", grams: 80 }],
    });
    expect(mealFits(m, { ...omni, avoidFoods: "гъби" })).toBe(false);
    expect(mealFits(m, { ...omni, avoidFoods: "ЛУК, ГЪБИ" })).toBe(false);
    expect(mealFits(m, { ...omni, avoidFoods: "ризото" })).toBe(false);
    expect(mealFits(m, { ...omni, avoidFoods: "лук, целина" })).toBe(true);
  });

  it.each(["гъби; лук", "гъби.", "(гъби)", "лук/гъби", "лук;гъби!"])(
    "avoid words keep working next to punctuation: %j",
    (avoidFoods) => {
      const m = meal({
        mealTypes: ["lunch"],
        title: "Ризото",
        ingredients: [{ name: "Гъби печурки", grams: 80 }],
      });
      expect(mealFits(m, { ...omni, avoidFoods })).toBe(false);
    },
  );

  it("punctuation alone is not an avoid word", () => {
    const m = meal({ mealTypes: ["lunch"], title: "Ризото" });
    expect(mealFits(m, { ...omni, avoidFoods: "..., ;;; ()" })).toBe(true);
  });

  it("ignores avoid words shorter than 3 letters", () => {
    const m = meal({
      mealTypes: ["lunch"],
      title: "Яйце на очи",
      ingredients: [{ name: "Яйце", grams: 60 }],
    });
    expect(mealFits(m, { ...omni, avoidFoods: "яй, на, о" })).toBe(true);
    expect(mealFits(m, { ...omni, avoidFoods: "яйце" })).toBe(false);
  });
});

describe("portionFactor", () => {
  it("is 1 when close and clamps to 0.75-1.5", () => {
    expect(portionFactor(400, 405)).toBe(1);
    expect(portionFactor(400, 700)).toBe(1.5);
    expect(portionFactor(400, 100)).toBe(0.75);
  });

  it("rounds half-up to the nearest 0.05", () => {
    expect(portionFactor(400, 330)).toBe(0.85);
    expect(portionFactor(500, 600)).toBe(1.2);
  });
});

describe("formatPortion", () => {
  it("uses a comma decimal and omits 1", () => {
    expect(formatPortion(1.2)).toBe("порция ×1,2");
    expect(formatPortion(0.85)).toBe("порция ×0,85");
    expect(formatPortion(1)).toBeNull();
  });
});

describe("scalePortion", () => {
  it("scales kcal, macros and ingredient grams", () => {
    const m = meal({
      mealTypes: ["lunch"],
      kcal: 401,
      proteinG: 33.3,
      carbsG: 10,
      fatG: 7.7,
      ingredients: [
        { name: "А", grams: 101 },
        { name: "Б", grams: 50 },
      ],
    });
    expect(scalePortion(m, 1.5)).toEqual({
      kcal: 602,
      proteinG: 50,
      carbsG: 15,
      fatG: 11.6,
      ingredients: [
        { name: "А", grams: 152 },
        { name: "Б", grams: 75 },
      ],
      grams: 227,
    });
  });

  it("divides the ingredient list by the portions it makes; kcal and macros are already per portion", () => {
    const loaf = meal({
      mealTypes: ["snack"],
      kcal: 216,
      servings: 8,
      ingredients: [
        { name: "Брашно", grams: 100 },
        { name: "Банани", grams: 240 },
      ],
    });
    expect(scalePortion(loaf, 1)).toMatchObject({
      kcal: 216,
      ingredients: [
        { name: "Брашно", grams: 13 },
        { name: "Банани", grams: 30 },
      ],
      grams: 43,
    });
  });

  it("returns the meal values at factor 1", () => {
    const m = meal({ mealTypes: ["lunch"] });
    expect(scalePortion(m, 1)).toMatchObject({ kcal: 500, proteinG: 20, grams: 100 });
  });
});

describe("buildMenu", () => {
  function library(): Meal[] {
    const out: Meal[] = [];
    for (let i = 0; i < 4; i++) {
      out.push(meal({ id: `b${i}`, mealTypes: ["breakfast"], kcal: 450 }));
      out.push(meal({ id: `l${i}`, mealTypes: ["lunch"], kcal: 720 }));
      out.push(meal({ id: `d${i}`, mealTypes: ["dinner"], kcal: 630 }));
    }
    return out;
  }
  const base = {
    prefs: omni,
    targetKcal: 1800,
    userId: "u1",
    date: "2026-10-24",
    swaps: new Map<number, string>(),
  };
  const ids = (m: ReturnType<typeof buildMenu>) => m.map((s) => s.pick?.meal.id ?? null);

  it("creates one slot per plan entry with slot kcal", () => {
    const menu = buildMenu({ ...base, meals: library() });
    expect(menu.map((s) => [s.slot, s.meal, s.slotKcal])).toEqual([
      [0, "breakfast", 450],
      [1, "lunch", 720],
      [2, "dinner", 630],
    ]);
  });

  it("is deterministic for the same member and date", () => {
    const meals = library();
    expect(ids(buildMenu({ ...base, meals }))).toEqual(ids(buildMenu({ ...base, meals })));
    expect(buildMenu({ ...base, meals })[0].candidates).toEqual(
      buildMenu({ ...base, meals })[0].candidates,
    );
  });

  it("varies the order across dates when meals tie", () => {
    const meals = library();
    const orders = new Set<string>();
    for (let day = 1; day <= 10; day++) {
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      orders.add(buildMenu({ ...base, meals, date })[0].candidates.join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("puts dishes that reach the slot calories first, the rest by closeness", () => {
    const meals = [
      meal({ id: "far", mealTypes: ["breakfast"], kcal: 900 }),
      meal({ id: "near", mealTypes: ["breakfast"], kcal: 440 }),
      meal({ id: "mid", mealTypes: ["breakfast"], kcal: 700 }),
    ];
    const [b] = buildMenu({ ...base, meals });
    expect(b.candidates).toEqual(["near", "mid", "far"]);
    expect(b.pick?.meal.id).toBe("near");
  });

  it("never serves the same meal twice in a day", () => {
    const shared = meal({ id: "shared", mealTypes: ["lunch", "dinner"], kcal: 700 });
    const menu = buildMenu({
      ...base,
      meals: [shared, meal({ id: "x", mealTypes: ["breakfast"] })],
    });
    const picks = ids(menu).filter(Boolean);
    expect(new Set(picks).size).toBe(picks.length);
    expect(menu[2].pick).toBeNull();
    expect(menu[2].candidates).toEqual([]);
  });

  it("serves every fitting dish once before any of them comes back", () => {
    const meals = [0, 1, 2, 3].map((i) =>
      meal({ id: `b${i}`, mealTypes: ["breakfast"], kcal: 440 + i * 5 }),
    );
    const picks = [1, 2, 3, 4, 5].map(
      (day) => buildMenu({ ...base, meals, date: `2026-11-0${day}` })[0].pick?.meal.id ?? null,
    );
    expect(new Set(picks.slice(0, 4)).size).toBe(4);
    expect(picks[4]).toBe(picks[0]);
  });

  it("gives different members their own order of dishes", () => {
    const meals = [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      meal({ id: `b${i}`, mealTypes: ["breakfast"], kcal: 440 + i * 3 }),
    );
    const week = (userId: string) =>
      [1, 2, 3, 4, 5, 6, 7]
        .map(
          (day) => buildMenu({ ...base, meals, userId, date: `2026-11-0${day}` })[0].pick?.meal.id,
        )
        .join();
    expect(week("member-a")).not.toBe(week("member-b"));
  });

  it("skips unpublished meals and meals of another type", () => {
    const meals = [
      meal({ id: "draft", mealTypes: ["breakfast"], published: false }),
      meal({ id: "lunchy", mealTypes: ["lunch"] }),
    ];
    const menu = buildMenu({ ...base, meals });
    expect(menu[0].pick).toBeNull();
    expect(menu[1].pick?.meal.id).toBe("lunchy");
  });

  it("uses a stored swap while the meal is still a candidate", () => {
    const meals = library();
    const auto = buildMenu({ ...base, meals });
    const swapTo = auto[1].candidates[2];
    const menu = buildMenu({ ...base, meals, swaps: new Map([[1, swapTo]]) });
    expect(menu[1].pick?.meal.id).toBe(swapTo);
    expect(menu[1].candidates).toEqual(auto[1].candidates);
  });

  it("ignores a swap whose meal is missing from the library", () => {
    const meals = library();
    const auto = buildMenu({ ...base, meals });
    const menu = buildMenu({ ...base, meals, swaps: new Map([[1, "gone"]]) });
    expect(ids(menu)).toEqual(ids(auto));
  });

  it("ignores a swap when the meal gained one of her allergens", () => {
    const meals = library();
    const target = meals.find((m) => m.id === "l3")!;
    const swapped = { ...target, allergens: ["nuts" as const] };
    const meals2 = meals.map((m) => (m.id === "l3" ? swapped : m));
    const menu = buildMenu({
      ...base,
      meals: meals2,
      prefs: { ...omni, allergens: ["nuts"] },
      swaps: new Map([[1, "l3"]]),
    });
    expect(menu[1].pick?.meal.id).not.toBe("l3");
    expect(menu[1].candidates).not.toContain("l3");
  });

  it("ignores a swap that is unpublished, of another type, or taken by an earlier slot", () => {
    const meals = [...library(), meal({ id: "unpub", mealTypes: ["lunch"], published: false })];
    const auto = buildMenu({ ...base, meals });
    expect(ids(buildMenu({ ...base, meals, swaps: new Map([[1, "unpub"]]) }))).toEqual(ids(auto));
    expect(ids(buildMenu({ ...base, meals, swaps: new Map([[1, "b0"]]) }))).toEqual(ids(auto));
    const shared = [
      meal({ id: "s", mealTypes: ["lunch", "dinner"], kcal: 700 }),
      meal({ id: "t", mealTypes: ["dinner"], kcal: 100 }),
    ];
    const menu = buildMenu({ ...base, meals: shared, swaps: new Map([[2, "s"]]) });
    expect(menu[1].pick?.meal.id).toBe("s");
    expect(menu[2].pick?.meal.id).toBe("t");
  });

  it("returns empty picks for an empty library", () => {
    const menu = buildMenu({ ...base, meals: [] });
    expect(menu).toHaveLength(3);
    for (const s of menu) {
      expect(s.pick).toBeNull();
      expect(s.candidates).toEqual([]);
    }
  });

  it("leaves only the slot without a fitting meal empty", () => {
    const meals = library().filter((m) => !m.mealTypes.includes("lunch"));
    const menu = buildMenu({ ...base, meals });
    expect(menu[0].pick).not.toBeNull();
    expect(menu[1].pick).toBeNull();
    expect(menu[2].pick).not.toBeNull();
  });

  it("respects diet, allergens and avoid words when selecting", () => {
    const meals = [
      meal({
        id: "ok",
        mealTypes: ["breakfast"],
        fitsVegan: true,
        fitsVegetarian: true,
        fitsPescatarian: true,
      }),
      meal({ id: "milk", mealTypes: ["breakfast"], fitsVegan: true, allergens: ["milk"] }),
      meal({ id: "meat", mealTypes: ["breakfast"] }),
      meal({ id: "mushroom", mealTypes: ["breakfast"], fitsVegan: true, title: "Гъби на тиган" }),
    ];
    const menu = buildMenu({
      ...base,
      meals,
      prefs: { diet: "vegan", allergens: ["milk"], avoidFoods: "гъби", mealsPerDay: 3 },
    });
    expect(menu[0].candidates).toEqual(["ok"]);
  });

  it("keeps the day total within 10 % of the target in a balanced library", () => {
    const meals = library();
    for (const date of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
      const menu = buildMenu({ ...base, meals, date, targetKcal: 1800 });
      const total = menu.reduce(
        (s, slot) => s + scalePortion(slot.pick!.meal, slot.pick!.factor).kcal,
        0,
      );
      expect(Math.abs(total - 1800)).toBeLessThanOrEqual(180);
    }
  });

  it("builds four and five slot days", () => {
    const meals = [
      ...library(),
      meal({ id: "s1", mealTypes: ["snack"], kcal: 180 }),
      meal({ id: "s2", mealTypes: ["snack"], kcal: 180 }),
    ];
    const four = buildMenu({ ...base, meals, prefs: { ...omni, mealsPerDay: 4 } });
    expect(four.map((s) => s.meal)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    const five = buildMenu({ ...base, meals, prefs: { ...omni, mealsPerDay: 5 } });
    expect(five.map((s) => s.meal)).toEqual(["breakfast", "lunch", "dinner", "snack", "snack"]);
    expect(new Set([five[3].pick?.meal.id, five[4].pick?.meal.id]).size).toBe(2);
  });
});

describe("nextCandidate", () => {
  const slotOf = (candidates: string[], pickId: string | null) => ({
    slot: 0,
    meal: "lunch" as const,
    slotKcal: 700,
    pick: pickId ? { meal: meal({ id: pickId, mealTypes: ["lunch"] }), factor: 1 } : null,
    candidates,
  });

  it("returns the next candidate and wraps at the end", () => {
    expect(nextCandidate(slotOf(["a", "b", "c"], "a"))).toBe("b");
    expect(nextCandidate(slotOf(["a", "b", "c"], "c"))).toBe("a");
  });

  it("returns null when there is nothing to change to", () => {
    expect(nextCandidate(slotOf([], null))).toBeNull();
    expect(nextCandidate(slotOf(["a"], "a"))).toBeNull();
  });
});
