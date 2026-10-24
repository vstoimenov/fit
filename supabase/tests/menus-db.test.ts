import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createAdminUser,
  createUser,
  grantAccess,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;
const createdMeals: string[] = [];

/** Calendar date in Europe/Sofia, `offsetDays` from today (the database's own day boundary). */
function sofiaDay(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function mealRow(over: Record<string, unknown> = {}) {
  return {
    title: "Овесена каша с ябълка",
    meal_types: ["breakfast" as const],
    ingredients: [
      { name: "Овесени ядки", grams: 60 },
      { name: "Ябълка", grams: 120 },
    ],
    kcal: 380,
    protein_g: 12,
    carbs_g: 62,
    fat_g: 8,
    fits_vegetarian: true,
    allergens: ["gluten"],
    steps: "Свари овесените ядки.",
    published: true,
    ...over,
  };
}

async function seedMeal(over: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await admin.from("meals").insert(mealRow(over)).select("id").single();
  if (error || !data) throw error ?? new Error("seed meal failed");
  createdMeals.push(data.id);
  return data.id;
}

async function member(
  label: string,
  opts: { access?: boolean } = {},
): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  if (opts.access ?? true) await grantAccess(admin, user.id);
  return { user, db: await signedInClient(user) };
}

beforeAll(async () => {
  admin = adminClient();
  const b = await createAdminUser(admin, "menus-boss");
  boss = b.db;
  bossId = b.user.id;
});

afterAll(async () => {
  if (createdMeals.length) await admin.from("meals").delete().in("id", createdMeals);
  await admin.from("meal_draft_calls").delete().gte("id", 0);
});

describe("meals: admin writes", () => {
  it("admin creates, updates and deletes a meal", async () => {
    const ins = await boss.from("meals").insert(mealRow()).select("*").single();
    expect(ins.error).toBeNull();
    const id = ins.data!.id;
    createdMeals.push(id);
    expect(ins.data).toMatchObject({
      title: "Овесена каша с ябълка",
      meal_types: ["breakfast"],
      kcal: 380,
      fits_vegan: false,
      fits_pescatarian: false,
      photo_url: null,
      published: true,
    });

    const upd = await boss
      .from("meals")
      .update({ title: "Овесена каша", kcal: 400, fits_vegan: true })
      .eq("id", id)
      .select("*")
      .single();
    expect(upd.error).toBeNull();
    expect(upd.data).toMatchObject({ title: "Овесена каша", kcal: 400, fits_vegan: true });
    expect(new Date(upd.data!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(ins.data!.updated_at).getTime(),
    );

    const del = await boss.from("meals").delete().eq("id", id).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
  });

  it("writes an audit row on admin insert", async () => {
    const { data } = await boss.from("meals").insert(mealRow()).select("id").single();
    createdMeals.push(data!.id);
    const log = await admin
      .from("audit_log")
      .select("actor_id, action, target_type")
      .eq("target_id", data!.id);
    expect(log.data).toEqual([{ actor_id: bossId, action: "insert", target_type: "meals" }]);
  });

  it("a member cannot write meals", async () => {
    const m = await member("menus-nowrite");
    const ins = await m.db.from("meals").insert(mealRow()).select("id");
    expect(ins.error).not.toBeNull();

    const id = await seedMeal();
    const upd = await m.db.from("meals").update({ title: "Хак" }).eq("id", id).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await m.db.from("meals").delete().eq("id", id).select("id");
    expect(del.data ?? []).toEqual([]);
    const row = await admin.from("meals").select("title").eq("id", id).single();
    expect(row.data?.title).toBe("Овесена каша с ябълка");
  });
});

describe("meals: reading", () => {
  it("a member with access reads published meals only", async () => {
    const m = await member("menus-read");
    const pub = await seedMeal({ title: "Публикувано ястие" });
    const draft = await seedMeal({ title: "Чернова", published: false });
    const { data } = await m.db.from("meals").select("id").in("id", [pub, draft]);
    expect((data ?? []).map((r) => r.id)).toEqual([pub]);
  });

  it("a member without access reads no meals", async () => {
    const m = await member("menus-noaccess", { access: false });
    const pub = await seedMeal();
    const { data } = await m.db.from("meals").select("id").eq("id", pub);
    expect(data).toEqual([]);
  });

  it("anon reads no meals", async () => {
    const pub = await seedMeal();
    const { data } = await anonClient().from("meals").select("id").eq("id", pub);
    expect(data ?? []).toEqual([]);
  });

  it("an admin reads drafts too", async () => {
    const draft = await seedMeal({ published: false });
    const { data } = await boss.from("meals").select("id").eq("id", draft);
    expect(data).toHaveLength(1);
  });
});

describe("meals: bounds", () => {
  const long = (n: number) => "а".repeat(n);
  const ingredients = (n: number) =>
    Array.from({ length: n }, (_v, i) => ({ name: `Продукт ${i}`, grams: 10 }));

  it.each([
    ["kcal 0", { kcal: 0 }],
    ["kcal 3001", { kcal: 3001 }],
    ["negative protein", { protein_g: -1 }],
    ["carbs 1001", { carbs_g: 1001 }],
    ["fat 1001", { fat_g: 1001 }],
    ["title 1 char", { title: "а" }],
    ["title 121 chars", { title: long(121) }],
    ["31 ingredients", { ingredients: ingredients(31) }],
    ["no ingredients", { ingredients: [] }],
    ["ingredients not an array", { ingredients: { name: "x", grams: 1 } }],
    ["ingredient grams 0", { ingredients: [{ name: "Сол", grams: 0 }] }],
    ["ingredient grams 2001", { ingredients: [{ name: "Сол", grams: 2001 }] }],
    ["ingredient without name", { ingredients: [{ name: "", grams: 5 }] }],
    ["ingredient name 81 chars", { ingredients: [{ name: long(81), grams: 5 }] }],
    ["ingredient without grams", { ingredients: [{ name: "Сол" }] }],
    ["unknown allergen", { allergens: ["gluten", "kiwi"] }],
    ["empty meal_types", { meal_types: [] }],
    ["5 meal_types", { meal_types: ["breakfast", "lunch", "dinner", "snack", "snack"] }],
    ["duplicate meal_types", { meal_types: ["lunch", "lunch"] }],
    ["steps over 10000", { steps: "а".repeat(10_001) }],
    ["http photo", { photo_url: "http://x.bg/a.jpg" }],
    ["javascript photo", { photo_url: "javascript:alert(1)" }],
    ["local photo with a query", { photo_url: "/photos/a.jpg?v=1" }],
  ])("rejects %s", async (_name, over) => {
    const { error } = await admin.from("meals").insert(mealRow(over));
    expect(error).not.toBeNull();
  });

  it("accepts the edges", async () => {
    const edge = await admin
      .from("meals")
      .insert(
        mealRow({
          title: "ab",
          kcal: 3000,
          protein_g: 1000,
          carbs_g: 0,
          fat_g: 0,
          ingredients: ingredients(30),
          meal_types: ["breakfast", "lunch", "dinner", "snack"],
          allergens: [],
          steps: "а".repeat(10_000),
          photo_url: "/photos/meals/a-1.jpg",
        }),
      )
      .select("id")
      .single();
    expect(edge.error).toBeNull();
    createdMeals.push(edge.data!.id);
    const small = await admin
      .from("meals")
      .insert(
        mealRow({
          kcal: 1,
          ingredients: [{ name: "а", grams: 2000 }],
          photo_url: "https://x.bg/a.jpg",
        }),
      )
      .select("id")
      .single();
    expect(small.error).toBeNull();
    createdMeals.push(small.data!.id);
  });
});

describe("menu_swaps", () => {
  it("a member upserts her own swap for today and can remove it", async () => {
    const m = await member("menus-swap");
    const a = await seedMeal();
    const b = await seedMeal({ title: "Друга каша" });
    const row = { user_id: m.user.id, menu_date: sofiaDay(), slot: 1, meal_id: a };

    const first = await m.db.from("menu_swaps").upsert(row).select("*").single();
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ slot: 1, meal_id: a });

    const second = await m.db
      .from("menu_swaps")
      .upsert({ ...row, meal_id: b })
      .select("*")
      .single();
    expect(second.error).toBeNull();
    expect(second.data?.meal_id).toBe(b);
    const count = await m.db.from("menu_swaps").select("slot").eq("user_id", m.user.id);
    expect(count.data).toHaveLength(1);

    const del = await m.db.from("menu_swaps").delete().eq("user_id", m.user.id).select("slot");
    expect(del.data).toHaveLength(1);
  });

  it("allows today-2 and rejects today-3, tomorrow and slots outside 0-4", async () => {
    const m = await member("menus-window");
    const meal = await seedMeal();
    const put = (menu_date: string, slot = 0) =>
      m.db.from("menu_swaps").insert({ user_id: m.user.id, menu_date, slot, meal_id: meal });
    expect((await put(sofiaDay(-2))).error).toBeNull();
    expect((await put(sofiaDay(-3))).error).not.toBeNull();
    expect((await put(sofiaDay(1))).error).not.toBeNull();
    expect((await put(sofiaDay(), 5)).error).not.toBeNull();
    expect((await put(sofiaDay(), -1)).error).not.toBeNull();
    // Moving an existing swap out of the window is rejected as well.
    const move = await m.db
      .from("menu_swaps")
      .update({ menu_date: sofiaDay(-9) })
      .eq("user_id", m.user.id)
      .select("slot");
    expect(move.error).not.toBeNull();
  });

  it("cannot write or read another member's swaps", async () => {
    const a = await member("menus-swap-a");
    const b = await member("menus-swap-b");
    const meal = await seedMeal();
    const own = await a.db
      .from("menu_swaps")
      .insert({ user_id: a.user.id, menu_date: sofiaDay(), slot: 0, meal_id: meal });
    expect(own.error).toBeNull();

    const spoof = await b.db
      .from("menu_swaps")
      .insert({ user_id: a.user.id, menu_date: sofiaDay(), slot: 1, meal_id: meal });
    expect(spoof.error).not.toBeNull();
    expect((await b.db.from("menu_swaps").select("slot").eq("user_id", a.user.id)).data).toEqual(
      [],
    );
    const upd = await b.db
      .from("menu_swaps")
      .update({ slot: 2 })
      .eq("user_id", a.user.id)
      .select("slot");
    expect(upd.data ?? []).toEqual([]);
    const del = await b.db.from("menu_swaps").delete().eq("user_id", a.user.id).select("slot");
    expect(del.data ?? []).toEqual([]);
    expect(
      (await admin.from("menu_swaps").select("slot").eq("user_id", a.user.id)).data,
    ).toHaveLength(1);
  });

  it("without access she can read her swaps but not write them", async () => {
    const m = await member("menus-swap-noaccess", { access: false });
    const meal = await seedMeal();
    const seeded = await admin
      .from("menu_swaps")
      .insert({ user_id: m.user.id, menu_date: sofiaDay(), slot: 0, meal_id: meal });
    expect(seeded.error).toBeNull();

    expect(
      (await m.db.from("menu_swaps").select("slot").eq("user_id", m.user.id)).data,
    ).toHaveLength(1);
    const ins = await m.db
      .from("menu_swaps")
      .insert({ user_id: m.user.id, menu_date: sofiaDay(), slot: 1, meal_id: meal });
    expect(ins.error).not.toBeNull();
    const upd = await m.db
      .from("menu_swaps")
      .update({ slot: 3 })
      .eq("user_id", m.user.id)
      .select("slot");
    expect(upd.data ?? []).toEqual([]);
    const del = await m.db.from("menu_swaps").delete().eq("user_id", m.user.id).select("slot");
    expect(del.data ?? []).toEqual([]);
    expect(
      (await admin.from("menu_swaps").select("slot").eq("user_id", m.user.id)).data,
    ).toHaveLength(1);
  });

  it("deleting a meal removes the swaps that point at it", async () => {
    const m = await member("menus-cascade-meal");
    const meal = await seedMeal();
    await m.db
      .from("menu_swaps")
      .insert({ user_id: m.user.id, menu_date: sofiaDay(), slot: 0, meal_id: meal });
    const del = await admin.from("meals").delete().eq("id", meal).select("id");
    expect(del.error).toBeNull();
    expect((await admin.from("menu_swaps").select("slot").eq("user_id", m.user.id)).data).toEqual(
      [],
    );
  });

  it("deleting a profile removes her swaps", async () => {
    const m = await member("menus-cascade-user");
    const meal = await seedMeal();
    await m.db
      .from("menu_swaps")
      .insert({ user_id: m.user.id, menu_date: sofiaDay(), slot: 0, meal_id: meal });
    const gone = await admin.auth.admin.deleteUser(m.user.id);
    expect(gone.error).toBeNull();
    expect((await admin.from("menu_swaps").select("slot").eq("user_id", m.user.id)).data).toEqual(
      [],
    );
  });

  it("anon sees nothing", async () => {
    const { data, error } = await anonClient().from("menu_swaps").select("slot");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

describe("claim_meal_draft_call", () => {
  it("is false for a member and for anon, and records nothing", async () => {
    await admin.from("meal_draft_calls").delete().gte("id", 0);
    const m = await member("menus-claim-client");
    expect((await m.db.rpc("claim_meal_draft_call")).data).toBe(false);
    const anon = await anonClient().rpc("claim_meal_draft_call");
    expect(anon.data === false || anon.error !== null).toBe(true);
    const { count } = await admin
      .from("meal_draft_calls")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("gives an admin 200 drafts per Sofia day, then false", async () => {
    await admin.from("meal_draft_calls").delete().gte("id", 0);
    const extra = await createAdminUser(admin, "menus-boss-2");
    const first = await boss.rpc("claim_meal_draft_call");
    expect(first.error).toBeNull();
    expect(first.data).toBe(true);
    // 199 more from the database side: the quota counts across all admins.
    const rows = Array.from({ length: 198 }, () => ({ admin_id: extra.user.id }));
    const filled = await admin.from("meal_draft_calls").insert(rows);
    expect(filled.error).toBeNull();
    expect((await extra.db.rpc("claim_meal_draft_call")).data).toBe(true); // the 200th
    expect((await boss.rpc("claim_meal_draft_call")).data).toBe(false);
    expect((await extra.db.rpc("claim_meal_draft_call")).data).toBe(false);
    const { count } = await admin
      .from("meal_draft_calls")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(200);
  });

  it("ignores calls from before Sofia midnight", async () => {
    await admin.from("meal_draft_calls").delete().gte("id", 0);
    const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const rows = Array.from({ length: 200 }, () => ({ admin_id: bossId, called_at: yesterday }));
    expect((await admin.from("meal_draft_calls").insert(rows)).error).toBeNull();
    expect((await boss.rpc("claim_meal_draft_call")).data).toBe(true);
  });

  it("keeps the log table closed to API roles", async () => {
    const m = await member("menus-claim-closed");
    const read = await m.db.from("meal_draft_calls").select("id");
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    const write = await boss.from("meal_draft_calls").insert({ admin_id: bossId });
    expect(write.error).not.toBeNull();
    const readAdmin = await boss.from("meal_draft_calls").select("id");
    expect(readAdmin.error !== null || (readAdmin.data ?? []).length === 0).toBe(true);
  });
});
