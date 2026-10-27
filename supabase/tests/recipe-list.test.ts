import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listRecipeMeals } from "@/server/nutrition/meals";
import { adminClient, createUser, grantAccess, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;
const created: string[] = [];
/** Published meals already in the local database; hidden while this file runs. */
let hidden: string[] = [];

async function recipe(title: string, photoUrl: string | null, createdAt: string): Promise<string> {
  const { data, error } = await admin
    .from("meals")
    .insert({
      title: `${title} ${randomUUID().slice(0, 8)}`,
      meal_types: ["breakfast"],
      ingredients: [{ name: "Съставка", grams: 100 }],
      kcal: 400,
      protein_g: 20,
      carbs_g: 40,
      fat_g: 10,
      steps: "1. Смеси.\n2. Сервирай.",
      photo_url: photoUrl,
      published: true,
      created_at: createdAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  created.push(data.id);
  return data.id;
}

beforeAll(async () => {
  admin = adminClient();
  const { data, error } = await admin.from("meals").select("id").eq("published", true);
  if (error) throw new Error(error.message);
  hidden = data.map((m) => m.id);
  if (hidden.length) await admin.from("meals").update({ published: false }).in("id", hidden);
});

afterAll(async () => {
  if (created.length) await admin.from("meals").delete().in("id", created);
  if (hidden.length) await admin.from("meals").update({ published: true }).in("id", hidden);
});

describe("listRecipeMeals", () => {
  it("shows recipes with a photo first, then the newest, so new dishes cannot push them out", async () => {
    const withPhoto = await recipe(
      "Със снимка",
      "/photos/recipe-banana-bread.jpg",
      "2026-10-01T10:00:00Z",
    );
    const newer = await recipe("Без снимка нова", null, "2026-10-03T10:00:00Z");
    await recipe("Без снимка стара", null, "2026-10-02T10:00:00Z");
    const user = await createUser(admin, "recipe-list");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);

    const list = await listRecipeMeals(db, 2);
    expect(list.map((m) => m.id)).toEqual([withPhoto, newer]);
  });
});
