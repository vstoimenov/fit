import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { isAppError } from "@/lib/app-error";
import { ALLERGENS, type Allergen, type MealSlot } from "@/lib/nutrition/labels";
import { buildMenu, scalePortion } from "@/lib/nutrition/menu";
import { calorieTarget } from "@/lib/nutrition/target";
import { sofiaToday } from "@/lib/progress-photos/today";
import { toMeal } from "@/server/admin/meals";
import { getDiaryDay, saveNutritionAnswers } from "@/server/nutrition/diary";
import { eatSlot, getMenuDay, swapSlot } from "@/server/nutrition/menu";
import {
  adminClient,
  createUser,
  grantAccess,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let createdMeals: string[] = [];

beforeAll(() => {
  admin = adminClient();
});

afterEach(async () => {
  // Every test builds its own meals and removes them, so the vegan/lupin meals of one test never reach another.
  if (createdMeals.length) await admin.from("meals").delete().in("id", createdMeals);
  createdMeals = [];
});

afterAll(async () => {
  if (createdMeals.length) await admin.from("meals").delete().in("id", createdMeals);
});

function sofiaDay(offsetDays = 0): string {
  const d = new Date(`${sofiaToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * The local database also holds other published meals. The test member is vegan and avoids every
 * allergen except the ones the test meals carry, so only the meals created here can fit her.
 */
const FREE: Allergen[] = ["lupin", "sesame"];
const ANSWERS = {
  birthYear: 1990,
  activity: "moderate" as const,
  diet: "vegan" as const,
  allergens: ALLERGENS.filter((a) => !FREE.includes(a)),
  avoidFoods: "",
  mealsPerDay: 3 as const,
};

async function member(
  label: string,
  opts: { access?: boolean; answers?: boolean; target?: boolean } = {},
): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  if (opts.access ?? true) await grantAccess(admin, user.id);
  const db = await signedInClient(user);
  if (opts.answers ?? true) await saveNutritionAnswers(db, user.id, ANSWERS);
  if (opts.target) {
    await admin
      .from("profiles")
      .update({ height_cm: 165, weight_kg: 70, goal: "lose_weight" })
      .eq("id", user.id);
  }
  return { user, db };
}

async function seedMeal(
  title: string,
  mealType: MealSlot,
  kcal: number,
  over: { allergens?: Allergen[]; published?: boolean } = {},
): Promise<string> {
  const { data, error } = await admin
    .from("meals")
    .insert({
      title: `${title} ${randomUUID().slice(0, 8)}`,
      meal_types: [mealType],
      ingredients: [
        { name: "Съставка едно", grams: 100 },
        { name: "Съставка две", grams: 55 },
      ],
      kcal,
      protein_g: 20,
      carbs_g: 40.5,
      fat_g: 10,
      fits_vegan: true,
      fits_vegetarian: true,
      fits_pescatarian: true,
      allergens: over.allergens ?? ["lupin"],
      steps: "",
      published: over.published ?? true,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("seed meal failed");
  createdMeals.push(data.id);
  return data.id;
}

/** Default target is 1800 kcal: breakfast 450, lunch 720, dinner 630. */
async function seedBasicDay() {
  const breakfasts = [
    await seedMeal("Закуска А", "breakfast", 450),
    await seedMeal("Закуска Б", "breakfast", 500),
    await seedMeal("Закуска В", "breakfast", 400),
  ];
  const lunch = await seedMeal("Обяд", "lunch", 720);
  const dinner = await seedMeal("Вечеря", "dinner", 630);
  return { breakfasts, lunch, dinner };
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to fail");
}

describe("getMenuDay", () => {
  it("builds three slots from her prefs and is stable across calls", async () => {
    const ids = await seedBasicDay();
    const { user, db } = await member("menu-stable");
    const first = await getMenuDay(db, user.id, sofiaDay());
    const second = await getMenuDay(db, user.id, sofiaDay());
    expect(first.hasAccess).toBe(true);
    expect(first.slots.map((s) => s.meal)).toEqual(["breakfast", "lunch", "dinner"]);
    expect(first.slots[0].candidates.sort()).toEqual([...ids.breakfasts].sort());
    expect(first.slots[1].pick?.meal.id).toBe(ids.lunch);
    expect(first.slots[2].pick?.meal.id).toBe(ids.dinner);
    expect(first.eatenSlots).toEqual([]);
    expect(second.slots.map((s) => s.pick?.meal.id)).toEqual(
      first.slots.map((s) => s.pick?.meal.id),
    );
  });

  it("without a computed target it uses 1800 kcal and says so; with one it uses hers", async () => {
    await seedBasicDay();
    const none = await member("menu-notarget");
    const day = await getMenuDay(none.db, none.user.id, sofiaDay());
    expect(day).toMatchObject({ usingDefaultTarget: true, targetKcal: 1800 });
    expect(day.slots.map((s) => s.slotKcal)).toEqual([450, 720, 630]);

    const withTarget = await member("menu-target", { target: true });
    const expected = calorieTarget({
      weightKg: 70,
      heightCm: 165,
      birthYear: 1990,
      activity: "moderate",
      goal: "lose_weight",
      today: sofiaToday(),
    });
    const real = await getMenuDay(withTarget.db, withTarget.user.id, sofiaDay());
    expect(expected).not.toBeNull();
    expect(real).toMatchObject({ usingDefaultTarget: false, targetKcal: expected!.kcal });
  });

  it("without saved answers it uses omnivore, no allergens and three meals", async () => {
    const { user, db } = await member("menu-noanswers", { answers: false });
    const day = await getMenuDay(db, user.id, sofiaDay());
    expect(day.slots.map((s) => s.meal)).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("an unpublished meal disappears from the menu", async () => {
    const ids = await seedBasicDay();
    const { user, db } = await member("menu-unpublish");
    const before = await getMenuDay(db, user.id, sofiaDay());
    expect(before.slots[1].pick?.meal.id).toBe(ids.lunch);
    await admin.from("meals").update({ published: false }).eq("id", ids.lunch);
    const after = await getMenuDay(db, user.id, sofiaDay());
    expect(after.slots[1].pick).toBeNull();
    expect(after.slots[1].candidates).toEqual([]);
  });

  it("without access she gets no menu and hasAccess false", async () => {
    await seedBasicDay();
    const { user, db } = await member("menu-noaccess", { access: false });
    const day = await getMenuDay(db, user.id, sofiaDay());
    expect(day.hasAccess).toBe(false);
    expect(day.slots).toEqual([]);
    expect(day.eatenSlots).toEqual([]);
  });

  it("meals picked on the two previous days (with their swaps) are not served again", async () => {
    // Without the recent rule the order is A (exact), B (portion ×1,5), C (portion ×0,75).
    const [a, b, c] = [
      await seedMeal("Закуска А", "breakfast", 450),
      await seedMeal("Закуска Б", "breakfast", 250),
      await seedMeal("Закуска В", "breakfast", 900),
    ];
    await seedMeal("Обяд", "lunch", 720);
    await seedMeal("Вечеря", "dinner", 630);
    const { user, db } = await member("menu-recent");
    // Both previous days served A; a swap on yesterday's breakfast to C also counts as served.
    const yesterdaySwap = c;
    const ins = await db.from("menu_swaps").insert({
      user_id: user.id,
      menu_date: sofiaDay(-1),
      slot: 0,
      meal_id: yesterdaySwap,
    });
    expect(ins.error).toBeNull();

    const rows = await admin.from("meals").select("*").in("id", createdMeals);
    const meals = (rows.data ?? []).map(toMeal);
    const prefs = {
      diet: "vegan" as const,
      allergens: ANSWERS.allergens,
      avoidFoods: "",
      mealsPerDay: 3 as const,
    };
    const served = (date: string, swaps: Map<number, string>) =>
      buildMenu({
        meals,
        prefs,
        targetKcal: 1800,
        userId: user.id,
        date,
        recentMealIds: new Set(),
        swaps,
      }).flatMap((s) => (s.pick ? [s.pick.meal.id] : []));
    const recent = new Set([
      ...served(sofiaDay(-1), new Map([[0, yesterdaySwap]])),
      ...served(sofiaDay(-2), new Map()),
    ]);
    expect([...recent].filter((id) => [a, b, c].includes(id)).sort()).toEqual([a, c].sort());

    const today = await getMenuDay(db, user.id, sofiaDay());
    const expected = buildMenu({
      meals,
      prefs,
      targetKcal: 1800,
      userId: user.id,
      date: sofiaDay(),
      recentMealIds: recent,
      swaps: new Map(),
    });
    expect(today.slots.map((s) => s.pick?.meal.id)).toEqual(expected.map((s) => s.pick?.meal.id));
    // A and C were served lately, so the breakfast is B although A fits her better.
    expect(today.slots[0].pick?.meal.id).toBe(b);
  });
});

describe("swapSlot", () => {
  it("moves to the next candidate, persists, and wraps around", async () => {
    await seedBasicDay();
    const { user, db } = await member("menu-swap");
    const today = sofiaDay();
    const start = await getMenuDay(db, user.id, today);
    const order = start.slots[0].candidates;
    expect(order).toHaveLength(3);
    expect(start.slots[0].pick?.meal.id).toBe(order[0]);

    await swapSlot(db, user.id, { day: today, slot: 0 });
    const one = await getMenuDay(db, user.id, today);
    expect(one.slots[0].pick?.meal.id).toBe(order[1]);
    const stored = await admin.from("menu_swaps").select("*").eq("user_id", user.id);
    expect(stored.data).toHaveLength(1);
    expect(stored.data?.[0]).toMatchObject({ menu_date: today, slot: 0, meal_id: order[1] });
    // Persisted: a fresh read sees the same menu, other slots untouched.
    const again = await getMenuDay(db, user.id, today);
    expect(again.slots.map((s) => s.pick?.meal.id)).toEqual(one.slots.map((s) => s.pick?.meal.id));
    expect(again.slots[1].pick?.meal.id).toBe(start.slots[1].pick?.meal.id);

    await swapSlot(db, user.id, { day: today, slot: 0 });
    expect((await getMenuDay(db, user.id, today)).slots[0].pick?.meal.id).toBe(order[2]);
    await swapSlot(db, user.id, { day: today, slot: 0 });
    expect((await getMenuDay(db, user.id, today)).slots[0].pick?.meal.id).toBe(order[0]);
    const rows = await admin.from("menu_swaps").select("slot").eq("user_id", user.id);
    expect(rows.data).toHaveLength(1);
  });

  it("an allergen added after a swap keeps the swapped meal off the menu", async () => {
    const a = await seedMeal("Закуска с лупина", "breakfast", 450, { allergens: ["lupin"] });
    const b = await seedMeal("Закуска със сусам", "breakfast", 450, { allergens: ["sesame"] });
    const allergenOf = new Map<string, Allergen>([
      [a, "lupin"],
      [b, "sesame"],
    ]);
    const { user, db } = await member("menu-allergen");
    const today = sofiaDay();
    await swapSlot(db, user.id, { day: today, slot: 0 });
    const swapped = (await getMenuDay(db, user.id, today)).slots[0].pick!.meal.id;
    expect([a, b]).toContain(swapped);

    await saveNutritionAnswers(db, user.id, {
      ...ANSWERS,
      allergens: [...ANSWERS.allergens, allergenOf.get(swapped)!],
    });
    const after = await getMenuDay(db, user.id, today);
    expect(after.slots[0].pick?.meal.id).toBe(swapped === a ? b : a);
    expect(after.slots[0].candidates).not.toContain(swapped);
  });

  it("refuses when there is no other meal, for other days, bad slots and without access", async () => {
    await seedBasicDay();
    const { user, db } = await member("menu-swap-refuse");
    const today = sofiaDay();

    const single = await failure(swapSlot(db, user.id, { day: today, slot: 1 }));
    expect(isAppError(single) && single.code).toBe("INVALID");
    const past = await failure(swapSlot(db, user.id, { day: sofiaDay(-1), slot: 0 }));
    expect(isAppError(past) && past.code).toBe("INVALID");
    const bad = await failure(swapSlot(db, user.id, { day: today, slot: 7 }));
    expect(isAppError(bad) && bad.code).toBe("INVALID");
    const fractional = await failure(swapSlot(db, user.id, { day: today, slot: 0.5 }));
    expect(isAppError(fractional) && fractional.code).toBe("INVALID");
    expect((await admin.from("menu_swaps").select("slot").eq("user_id", user.id)).data).toEqual([]);

    const lapsed = await member("menu-swap-lapsed", { access: false });
    const refused = await failure(swapSlot(lapsed.db, lapsed.user.id, { day: today, slot: 0 }));
    expect(isAppError(refused) && refused.code).toBe("INVALID");
    expect((refused as Error).message).toBe("Нужен е активен абонамент.");
  });
});

describe("eatSlot", () => {
  it("adds one menu entry with the portion values and marks the slot eaten", async () => {
    const meal = await seedMeal("Закуска порция", "breakfast", 500);
    await seedMeal("Обяд", "lunch", 720);
    const { user, db } = await member("menu-eat");
    const today = sofiaDay();
    const before = await getMenuDay(db, user.id, today);
    const pick = before.slots[0].pick!;
    expect(pick.meal.id).toBe(meal);
    expect(pick.factor).toBe(0.9);
    const portion = scalePortion(pick.meal, pick.factor);

    await eatSlot(db, user.id, { day: today, slot: 0, batchId: randomUUID() });

    const diary = await getDiaryDay(db, user.id, today);
    expect(diary.entries).toHaveLength(1);
    expect(diary.entries[0]).toMatchObject({
      source: "menu",
      meal: "breakfast",
      name: pick.meal.title,
      grams: portion.grams,
      kcal: 450,
      proteinG: portion.proteinG,
      carbsG: portion.carbsG,
      fatG: portion.fatG,
    });
    expect(portion.kcal).toBe(450);
    const after = await getMenuDay(db, user.id, today);
    expect(after.eatenSlots).toEqual([0]);
  });

  it("a retry with the same batch id adds nothing", async () => {
    await seedBasicDay();
    const { user, db } = await member("menu-eat-retry");
    const today = sofiaDay();
    const batchId = randomUUID();
    await eatSlot(db, user.id, { day: today, slot: 1, batchId });
    await eatSlot(db, user.id, { day: today, slot: 1, batchId });
    const diary = await getDiaryDay(db, user.id, today);
    expect(diary.entries).toHaveLength(1);
    expect((await getMenuDay(db, user.id, today)).eatenSlots).toEqual([1]);
  });

  it("a second tap with a new batch id adds nothing, and the eaten slot can no longer be swapped", async () => {
    const [a] = [
      await seedMeal("Закуска А", "breakfast", 450),
      await seedMeal("Закуска Б", "breakfast", 450),
    ];
    expect(a).toBeTruthy();
    const { user, db } = await member("menu-eat-twice");
    const today = sofiaDay();
    await eatSlot(db, user.id, { day: today, slot: 0, batchId: randomUUID() });
    await eatSlot(db, user.id, { day: today, slot: 0, batchId: randomUUID() });
    expect((await getDiaryDay(db, user.id, today)).entries).toHaveLength(1);

    const before = (await getMenuDay(db, user.id, today)).slots[0].pick?.meal.id;
    const swap = await failure(swapSlot(db, user.id, { day: today, slot: 0 }));
    expect(isAppError(swap) && swap.code).toBe("INVALID");
    expect((swap as Error).message).toBe("Това ястие вече е записано в дневника.");
    expect((await getMenuDay(db, user.id, today)).slots[0].pick?.meal.id).toBe(before);
    expect((await admin.from("menu_swaps").select("slot").eq("user_id", user.id)).data).toEqual([]);
  });

  it("refuses without access, for other days, bad slots, empty slots and bad batch ids", async () => {
    await seedBasicDay();
    const today = sofiaDay();
    const lapsed = await member("menu-eat-lapsed", { access: false });
    const refused = await failure(
      eatSlot(lapsed.db, lapsed.user.id, { day: today, slot: 0, batchId: randomUUID() }),
    );
    expect(isAppError(refused) && refused.code).toBe("INVALID");
    expect((refused as Error).message).toBe("Нужен е активен абонамент.");

    const { user, db } = await member("menu-eat-refuse");
    const past = await failure(
      eatSlot(db, user.id, { day: sofiaDay(-1), slot: 0, batchId: randomUUID() }),
    );
    expect(isAppError(past) && past.code).toBe("INVALID");
    expect((past as Error).message).toBe("Менюто е само за днес.");
    const bad = await failure(eatSlot(db, user.id, { day: today, slot: 9, batchId: randomUUID() }));
    expect(isAppError(bad) && bad.code).toBe("INVALID");
    const batch = await failure(eatSlot(db, user.id, { day: today, slot: 0, batchId: "nope" }));
    expect(isAppError(batch) && batch.code).toBe("INVALID");

    await admin.from("meals").update({ published: false }).eq("id", createdMeals[3]);
    const empty = await failure(
      eatSlot(db, user.id, { day: today, slot: 1, batchId: randomUUID() }),
    );
    expect(isAppError(empty) && empty.code).toBe("INVALID");
    expect((await getDiaryDay(db, user.id, today)).entries).toEqual([]);
  });
});
