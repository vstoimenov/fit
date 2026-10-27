import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import {
  adminClient,
  anonClient,
  createUser,
  grantAccess,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

type FoodUpdate = Database["public"]["Tables"]["food_entries"]["Update"];

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

/** Calendar date in Europe/Sofia, `offsetDays` from today (the database's own day boundary). */
function sofiaDay(offsetDays = 0): string {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function member(
  label: string,
  opts: { access?: boolean } = {},
): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  if (opts.access ?? true) await grantAccess(admin, user.id);
  return { user, db: await signedInClient(user) };
}

function entry(userId: string, over: Record<string, unknown> = {}) {
  return {
    user_id: userId,
    batch_id: randomUUID(),
    position: 0,
    eaten_on: sofiaDay(),
    meal: "lunch" as const,
    name: "Пилешка салата",
    grams: 250,
    kcal: 320,
    protein_g: 28,
    carbs_g: 12,
    fat_g: 14,
    source: "ai" as const,
    ...over,
  };
}

async function rowOf(id: string) {
  const { data, error } = await admin.from("food_entries").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("food_entries: own rows", () => {
  it("member with access inserts, updates and deletes her own entries", async () => {
    const { user, db } = await member("food-own");
    const ins = await db.from("food_entries").insert(entry(user.id)).select("*").single();
    expect(ins.error).toBeNull();
    expect(ins.data?.kcal).toBe(320);
    const id = ins.data!.id;

    const upd = await db
      .from("food_entries")
      .update({ name: "Салата с авокадо", grams: 300, kcal: 400 })
      .eq("id", id)
      .select("*")
      .single();
    expect(upd.error).toBeNull();
    expect(upd.data).toMatchObject({ name: "Салата с авокадо", kcal: 400 });

    const del = await db.from("food_entries").delete().eq("id", id).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    const left = await admin.from("food_entries").select("id").eq("id", id);
    expect(left.data).toEqual([]);
  });

  it("cannot read, insert for, update or delete another member's entries", async () => {
    const a = await member("food-a");
    const b = await member("food-b");
    const own = await a.db.from("food_entries").insert(entry(a.user.id)).select("id").single();
    const id = own.data!.id;

    expect((await b.db.from("food_entries").select("id").eq("id", id)).data).toEqual([]);
    const spoof = await b.db.from("food_entries").insert(entry(a.user.id));
    expect(spoof.error).not.toBeNull();
    const upd = await b.db.from("food_entries").update({ kcal: 1 }).eq("id", id).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await b.db.from("food_entries").delete().eq("id", id).select("id");
    expect(del.data ?? []).toEqual([]);
    expect((await rowOf(id)).kcal).toBe(320);
  });

  it("member without access can read but not insert, update or delete", async () => {
    const m = await member("food-noaccess", { access: false });
    const seeded = await admin.from("food_entries").insert(entry(m.user.id)).select("id").single();
    expect(seeded.error).toBeNull();
    const id = seeded.data!.id;

    const read = await m.db.from("food_entries").select("id").eq("id", id);
    expect(read.data).toHaveLength(1);

    const ins = await m.db.from("food_entries").insert(entry(m.user.id));
    expect(ins.error).not.toBeNull();
    const upd = await m.db.from("food_entries").update({ kcal: 1 }).eq("id", id).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await m.db.from("food_entries").delete().eq("id", id).select("id");
    expect(del.data ?? []).toEqual([]);
    expect((await rowOf(id)).kcal).toBe(320);
  });

  it("anon sees nothing and writes nothing", async () => {
    const anon = anonClient();
    const read = await anon.from("food_entries").select("id").limit(1);
    expect(read.error).not.toBeNull();
    const ins = await anon.from("food_entries").insert(entry(randomUUID()));
    expect(ins.error).not.toBeNull();
  });
});

describe("food_entries: she may change only the amounts", () => {
  it("refuses to change user_id", async () => {
    const a = await member("food-imm-a");
    const b = await member("food-imm-b");
    const { data } = await a.db.from("food_entries").insert(entry(a.user.id)).select("id").single();
    const res = await a.db.from("food_entries").update({ user_id: b.user.id }).eq("id", data!.id);
    expect(res.error).not.toBeNull();
    expect((await rowOf(data!.id)).user_id).toBe(a.user.id);
  });

  it("refuses to change eaten_on, meal, batch_id, position, source or created_at", async () => {
    const m = await member("food-imm-cols");
    const { data } = await m.db.from("food_entries").insert(entry(m.user.id)).select("id").single();
    const before = await rowOf(data!.id);
    const changes: FoodUpdate[] = [
      { eaten_on: sofiaDay(-1) },
      { meal: "dinner" },
      { batch_id: randomUUID() },
      { position: 5 },
      { source: "manual" },
      { created_at: new Date(0).toISOString() },
    ];
    for (const change of changes) {
      const res = await m.db.from("food_entries").update(change).eq("id", data!.id);
      expect(res.error, JSON.stringify(change)).not.toBeNull();
    }
    expect(await rowOf(data!.id)).toEqual(before);
  });

  it("still lets her change all six amount columns", async () => {
    const m = await member("food-amounts");
    const { data } = await m.db.from("food_entries").insert(entry(m.user.id)).select("id").single();
    const res = await m.db
      .from("food_entries")
      .update({ name: "Друго", grams: null, kcal: 10, protein_g: 1.5, carbs_g: 2.5, fat_g: 3.5 })
      .eq("id", data!.id)
      .select("*")
      .single();
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ name: "Друго", grams: null, kcal: 10, protein_g: 1.5 });
  });
});

describe("food_entries: date window and daily cap", () => {
  it("accepts today and exactly 365 days ago, rejects tomorrow and 366 days ago", async () => {
    const { user, db } = await member("food-dates");
    expect((await db.from("food_entries").insert(entry(user.id))).error).toBeNull();
    expect(
      (await db.from("food_entries").insert(entry(user.id, { eaten_on: sofiaDay(-365) }))).error,
    ).toBeNull();

    const future = await db.from("food_entries").insert(entry(user.id, { eaten_on: sofiaDay(1) }));
    expect(future.error?.message).toContain("Датата трябва да е до днес.");
    const old = await db.from("food_entries").insert(entry(user.id, { eaten_on: sofiaDay(-366) }));
    expect(old.error).not.toBeNull();
    expect(old.error?.code).toBe("22023");
  });

  it("rejects the 101st entry of a day, but another day is unaffected", async () => {
    const { user, db } = await member("food-cap");
    const batch = randomUUID();
    const rows = Array.from({ length: 100 }, (_, i) =>
      entry(user.id, { batch_id: batch, position: i, name: `Храна ${i}` }),
    );
    const bulk = await db.from("food_entries").insert(rows);
    expect(bulk.error).toBeNull();

    const extra = await db.from("food_entries").insert(entry(user.id));
    expect(extra.error?.message).toContain("Достигна 100 записа за деня.");
    expect(extra.error?.code).toBe("P0001");

    const otherDay = await db
      .from("food_entries")
      .insert(entry(user.id, { eaten_on: sofiaDay(-1) }));
    expect(otherDay.error).toBeNull();
  });

  it("one member's full day does not block another member", async () => {
    const a = await member("food-cap-a");
    const b = await member("food-cap-b");
    const rows = Array.from({ length: 100 }, (_, i) =>
      entry(a.user.id, { batch_id: randomUUID(), position: i }),
    );
    expect((await admin.from("food_entries").insert(rows)).error).toBeNull();
    expect((await b.db.from("food_entries").insert(entry(b.user.id))).error).toBeNull();
  });
});

describe("food_entries: value checks", () => {
  it("rejects kcal 5001 and accepts 5000", async () => {
    const { user, db } = await member("food-kcal");
    const over = await db.from("food_entries").insert(entry(user.id, { kcal: 5001 }));
    expect(over.error?.code).toBe("23514");
    const ok = await db.from("food_entries").insert(entry(user.id, { kcal: 5000 }));
    expect(ok.error).toBeNull();
  });

  it("rejects an empty or too long name", async () => {
    const { user, db } = await member("food-name");
    expect((await db.from("food_entries").insert(entry(user.id, { name: "" }))).error?.code).toBe(
      "23514",
    );
    expect(
      (await db.from("food_entries").insert(entry(user.id, { name: "x".repeat(121) }))).error?.code,
    ).toBe("23514");
    expect(
      (await db.from("food_entries").insert(entry(user.id, { name: "x".repeat(120) }))).error,
    ).toBeNull();
  });

  it("rejects negative macros, grams outside 1..2000 and position outside 0..99", async () => {
    const { user, db } = await member("food-bounds");
    const bad: Record<string, unknown>[] = [
      { protein_g: -1 },
      { carbs_g: 1001 },
      { fat_g: -0.1 },
      { grams: 0 },
      { grams: 2001 },
      { kcal: -1 },
      { position: -1 },
      { position: 100 },
    ];
    for (const over of bad) {
      const res = await db.from("food_entries").insert(entry(user.id, over));
      expect(res.error?.code, JSON.stringify(over)).toBe("23514");
    }
  });
});

describe("food_entries: idempotent batches", () => {
  it("a retried insert of the same batch position conflicts", async () => {
    const { user, db } = await member("food-idem");
    const row = entry(user.id);
    expect((await db.from("food_entries").insert(row)).error).toBeNull();
    const again = await db.from("food_entries").insert(row);
    expect(again.error?.code).toBe("23505");
    const rows = await admin.from("food_entries").select("id").eq("batch_id", row.batch_id);
    expect(rows.data).toHaveLength(1);
  });

  it("the same name twice in one batch (different positions) is stored twice", async () => {
    const { user, db } = await member("food-twice");
    const batch = randomUUID();
    const res = await db
      .from("food_entries")
      .insert([
        entry(user.id, { batch_id: batch, position: 0, name: "Филия хляб" }),
        entry(user.id, { batch_id: batch, position: 1, name: "Филия хляб" }),
      ])
      .select("id");
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2);
  });

  it("two members may reuse the same batch id and position", async () => {
    const a = await member("food-idem-a");
    const b = await member("food-idem-b");
    const batch_id = randomUUID();
    expect(
      (await a.db.from("food_entries").insert(entry(a.user.id, { batch_id }))).error,
    ).toBeNull();
    expect(
      (await b.db.from("food_entries").insert(entry(b.user.id, { batch_id }))).error,
    ).toBeNull();
  });
});

describe("profile nutrition answers", () => {
  it("member saves her answers", async () => {
    const { user, db } = await member("nut-answers");
    const answeredAt = new Date().toISOString();
    const res = await db
      .from("profiles")
      .update({
        birth_year: 1990,
        activity_level: "moderate",
        diet: "vegetarian",
        allergens: ["gluten", "milk", "molluscs"],
        avoid_foods: "праз, черен дроб",
        meals_per_day: 4,
        nutrition_answered_at: answeredAt,
      })
      .eq("id", user.id)
      .select("*")
      .single();
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({
      birth_year: 1990,
      activity_level: "moderate",
      diet: "vegetarian",
      allergens: ["gluten", "milk", "molluscs"],
      meals_per_day: 4,
    });
  });

  it("new profiles start with no allergens and no answers", async () => {
    const { user } = await member("nut-defaults");
    const { data } = await admin.from("profiles").select("*").eq("id", user.id).single();
    expect(data).toMatchObject({
      allergens: [],
      birth_year: null,
      activity_level: null,
      diet: null,
      avoid_foods: null,
      meals_per_day: null,
      nutrition_answered_at: null,
    });
  });

  it("allergens must be known codes", async () => {
    const { user, db } = await member("nut-allergens");
    const bad = await db
      .from("profiles")
      .update({ allergens: ["gluten", "xyz"] })
      .eq("id", user.id);
    expect(bad.error?.code).toBe("23514");
    const all14 = [
      "gluten",
      "crustaceans",
      "eggs",
      "fish",
      "peanuts",
      "soy",
      "milk",
      "nuts",
      "celery",
      "mustard",
      "sesame",
      "sulphites",
      "lupin",
      "molluscs",
    ];
    expect(
      (await db.from("profiles").update({ allergens: all14 }).eq("id", user.id)).error,
    ).toBeNull();
    expect(
      (await db.from("profiles").update({ allergens: [] }).eq("id", user.id)).error,
    ).toBeNull();
  });

  it("rejects meals_per_day outside 3..5, a long avoid_foods and an unknown diet or activity", async () => {
    const { user, db } = await member("nut-bounds");
    for (const bad of [2, 6]) {
      const res = await db.from("profiles").update({ meals_per_day: bad }).eq("id", user.id);
      expect(res.error?.code, `meals ${bad}`).toBe("23514");
    }
    for (const ok of [3, 4, 5]) {
      expect(
        (await db.from("profiles").update({ meals_per_day: ok }).eq("id", user.id)).error,
      ).toBeNull();
    }
    const long = await db
      .from("profiles")
      .update({ avoid_foods: "x".repeat(201) })
      .eq("id", user.id);
    expect(long.error?.code).toBe("23514");
    expect(
      (
        await db
          .from("profiles")
          .update({ avoid_foods: "x".repeat(200) })
          .eq("id", user.id)
      ).error,
    ).toBeNull();
    const diet = await db
      .from("profiles")
      // @ts-expect-error deliberately outside the enum
      .update({ diet: "carnivore" })
      .eq("id", user.id);
    expect(diet.error).not.toBeNull();
    const act = await db
      .from("profiles")
      // @ts-expect-error deliberately outside the enum
      .update({ activity_level: "extreme" })
      .eq("id", user.id);
    expect(act.error).not.toBeNull();
  });

  it("still cannot change the role", async () => {
    const { user, db } = await member("nut-role");
    const res = await db.from("profiles").update({ role: "admin" }).eq("id", user.id);
    expect(res.error).not.toBeNull();
  });
});

describe("claim_nutrition_ai_call", () => {
  it("returns true 60 times, then false", async () => {
    const { user, db } = await member("ai-quota");
    for (let i = 0; i < 60; i++) {
      const res = await db.rpc("claim_nutrition_ai_call");
      expect(res.error).toBeNull();
      expect(res.data, `call ${i + 1}`).toBe(true);
    }
    const over = await db.rpc("claim_nutrition_ai_call");
    expect(over.error).toBeNull();
    expect(over.data).toBe(false);
    const { count } = await admin
      .from("nutrition_ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(count).toBe(60);
  });

  it("counts only calls since Sofia midnight", async () => {
    const { user, db } = await member("ai-yesterday");
    const old = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const seed = await admin
      .from("nutrition_ai_calls")
      .insert(Array.from({ length: 70 }, () => ({ user_id: user.id, called_at: old })));
    expect(seed.error).toBeNull();
    const res = await db.rpc("claim_nutrition_ai_call");
    expect(res.data).toBe(true);
  });

  it("one member's quota does not affect another", async () => {
    const a = await member("ai-quota-a");
    const b = await member("ai-quota-b");
    const seed = await admin
      .from("nutrition_ai_calls")
      .insert(Array.from({ length: 60 }, () => ({ user_id: a.user.id })));
    expect(seed.error).toBeNull();
    expect((await a.db.rpc("claim_nutrition_ai_call")).data).toBe(false);
    expect((await b.db.rpc("claim_nutrition_ai_call")).data).toBe(true);
  });

  it("returns false without access and records nothing", async () => {
    const { user, db } = await member("ai-noaccess", { access: false });
    const res = await db.rpc("claim_nutrition_ai_call");
    expect(res.error).toBeNull();
    expect(res.data).toBe(false);
    const { count } = await admin
      .from("nutrition_ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(count).toBe(0);
  });

  it("anon cannot execute it", async () => {
    const res = await anonClient().rpc("claim_nutrition_ai_call");
    expect(res.error).not.toBeNull();
    expect(res.data).toBeNull();
  });

  it("members cannot read or write the call log directly", async () => {
    const { user, db } = await member("ai-log");
    await db.rpc("claim_nutrition_ai_call");
    const read = await db.from("nutrition_ai_calls").select("id");
    expect(read.error).not.toBeNull();
    const ins = await db.from("nutrition_ai_calls").insert({ user_id: user.id });
    expect(ins.error).not.toBeNull();
  });
});

describe("account deletion", () => {
  it("cascades entries and AI calls when the member is deleted", async () => {
    const { user, db } = await member("food-cascade");
    expect((await db.from("food_entries").insert(entry(user.id))).error).toBeNull();
    expect((await db.rpc("claim_nutrition_ai_call")).data).toBe(true);

    const del = await admin.auth.admin.deleteUser(user.id);
    expect(del.error).toBeNull();

    const entries = await admin.from("food_entries").select("id").eq("user_id", user.id);
    expect(entries.data).toEqual([]);
    const calls = await admin.from("nutrition_ai_calls").select("id").eq("user_id", user.id);
    expect(calls.data).toEqual([]);
  });
});

describe("food_entries: drinks", () => {
  it("stores a drink in its own diary group, picked from the quick list", async () => {
    const { user, db } = await member("drinks-own");
    const { data, error } = await db
      .from("food_entries")
      .insert(
        entry(user.id, {
          meal: "drinks",
          name: "Капучино",
          grams: 180,
          kcal: 80,
          protein_g: 4.5,
          carbs_g: 6.5,
          fat_g: 4,
          source: "preset",
        }),
      )
      .select("meal, source")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ meal: "drinks", source: "preset" });
  });

  it("is a diary group only: a menu meal cannot be typed as a drink", async () => {
    const { data, error } = await admin.rpc(
      "meal_types_valid" as never,
      {
        p_types: ["drinks"],
      } as never,
    );
    expect(error).toBeNull();
    expect(data).toBe(false);
    const ok = await admin.rpc("meal_types_valid" as never, { p_types: ["lunch"] } as never);
    expect(ok.data).toBe(true);
  });
});
