import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MealInput } from "@/lib/nutrition/meal-schema";
import { deleteMeal, getMeal, listMeals, saveMeal, setMealPublished } from "@/server/admin/meals";
import {
  adminClient,
  createAdminUser,
  createUser,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const tag = `adm-meal-${Math.random().toString(36).slice(2, 8)}`;
const createdIds: string[] = [];

const input = (name: string, over: Partial<MealInput> = {}): MealInput => ({
  title: `${tag} ${name}`,
  mealTypes: ["breakfast"],
  ingredients: [{ name: "Овесени ядки", grams: 60 }],
  kcal: 420,
  proteinG: 14.5,
  carbsG: 70,
  fatG: 8,
  fitsVegetarian: true,
  fitsVegan: false,
  fitsPescatarian: true,
  allergens: ["gluten"],
  steps: "Свари ядките.",
  photoUrl: null,
  description: "",
  prepMin: null,
  cookMin: null,
  servings: 1,
  ...over,
});

async function create(name: string, over: Partial<MealInput> = {}) {
  const id = await saveMeal(boss, input(name, over));
  createdIds.push(id);
  return id;
}

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "adm-meal")).db;
});

afterAll(async () => {
  if (createdIds.length) await admin.from("meals").delete().in("id", createdIds);
});

describe("admin meals service", () => {
  it("creates a draft meal and reads it back in camelCase", async () => {
    const id = await create("flow", { photoUrl: "/photos/kasha.jpg" });
    expect(await getMeal(boss, id)).toEqual({
      ...input("flow", { photoUrl: "/photos/kasha.jpg" }),
      id,
      published: false,
    });
  });

  it("edits every field, publishes, unpublishes and deletes", async () => {
    const id = await create("edit");
    const changed = input("edit", {
      title: `${tag} нова`,
      mealTypes: ["lunch", "dinner"],
      ingredients: [
        { name: "Ориз", grams: 80 },
        { name: "Пиле", grams: 120.5 },
      ],
      kcal: 610,
      proteinG: 40,
      carbsG: 60.5,
      fatG: 12,
      fitsVegetarian: false,
      fitsVegan: false,
      fitsPescatarian: false,
      allergens: [],
      steps: "",
    });
    expect(await saveMeal(boss, { ...changed, id })).toBe(id);
    expect(await getMeal(boss, id)).toEqual({ ...changed, id, published: false });

    await setMealPublished(boss, id, true);
    expect((await getMeal(boss, id))?.published).toBe(true);
    await setMealPublished(boss, id, false);
    expect((await getMeal(boss, id))?.published).toBe(false);

    await deleteMeal(boss, id);
    expect(await getMeal(boss, id)).toBeNull();
  });

  it("saves the publication state when it is given, and leaves it alone when it is not", async () => {
    const id = await saveMeal(boss, { ...input("pub"), published: true });
    createdIds.push(id);
    expect((await getMeal(boss, id))?.published).toBe(true);
    await saveMeal(boss, { ...input("pub", { kcal: 450 }), id });
    expect(await getMeal(boss, id)).toMatchObject({ kcal: 450, published: true });
    await saveMeal(boss, { ...input("pub"), id, published: false });
    expect((await getMeal(boss, id))?.published).toBe(false);
  });

  it("lists meals with their update time, newest first", async () => {
    const first = await create("l-1");
    const second = await create("l-2");
    const mine = (await listMeals(boss)).filter((m) => [first, second].includes(m.id));
    expect(mine.map((m) => m.id)).toEqual([second, first]);
    expect(mine[0]).toMatchObject({
      title: `${tag} l-2`,
      mealTypes: ["breakfast"],
      published: false,
    });
    expect(Number.isNaN(Date.parse(mine[0].updatedAt))).toBe(false);
  });

  it("keeps the recipe details: description, times, servings and spoon units", async () => {
    const id = await create("banana bread", {
      description: "Сочен кекс с фурми.",
      prepMin: 15,
      cookMin: 35,
      servings: 8,
      ingredients: [
        { name: "Спелтово брашно", grams: 100 },
        { name: "Бакпулвер", grams: 6, amount: 1.5, unit: "ч.л." },
        { name: "Растително мляко", grams: 50, amount: 50, unit: "мл" },
      ],
    });
    const meal = await getMeal(boss, id);
    expect(meal).toMatchObject({
      description: "Сочен кекс с фурми.",
      prepMin: 15,
      cookMin: 35,
      servings: 8,
      ingredients: [
        { name: "Спелтово брашно", grams: 100 },
        { name: "Бакпулвер", grams: 6, amount: 1.5, unit: "ч.л." },
        { name: "Растително мляко", grams: 50, amount: 50, unit: "мл" },
      ],
    });
    // The database refuses a unit it does not know, even past the app's own check.
    const { error } = await admin
      .from("meals")
      .update({ ingredients: [{ name: "Сол", grams: 3, amount: 1, unit: "кофа" }] })
      .eq("id", id);
    expect(error?.code).toBe("23514");
    const servings = await admin.from("meals").update({ servings: 0 }).eq("id", id);
    expect(servings.error?.code).toBe("23514");
  });

  it("rejects input beyond the meal bounds before touching the database", async () => {
    await expect(saveMeal(boss, input("bad", { kcal: 3001 }))).rejects.toThrow();
    await expect(saveMeal(boss, input("bad", { ingredients: [] }))).rejects.toThrow();
  });

  it("reports a missing meal", async () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    expect(await getMeal(boss, missing)).toBeNull();
    await expect(saveMeal(boss, { ...input("none"), id: missing })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(setMealPublished(boss, missing, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteMeal(boss, missing)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses all writes to a non-admin and hides unpublished meals from her", async () => {
    const id = await create("guarded");
    const db = await signedInClient(await createUser(admin, "adm-meal-member"));
    await expect(saveMeal(db, input("member"))).rejects.toThrow();
    await expect(
      saveMeal(db, { ...input("guarded", { title: `${tag} hacked` }), id }),
    ).rejects.toThrow();
    await expect(setMealPublished(db, id, true)).rejects.toThrow();
    await expect(deleteMeal(db, id)).rejects.toThrow();
    expect(await getMeal(db, id)).toBeNull();
    const { data } = await admin.from("meals").select("title, published").eq("id", id).single();
    expect(data).toEqual({ title: `${tag} guarded`, published: false });
  });

  it("lets only an admin take an AI draft from the shared daily quota", async () => {
    const member = await signedInClient(await createUser(admin, "adm-meal-quota"));
    expect((await member.rpc("claim_meal_draft_call")).data).toBe(false);
  });
});
