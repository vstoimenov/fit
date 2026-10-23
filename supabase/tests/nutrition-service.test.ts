import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { isAppError } from "@/lib/app-error";
import { sofiaToday } from "@/lib/progress-photos/today";
import { calorieTarget } from "@/lib/nutrition/target";
import {
  addEntries,
  deleteEntry,
  getDiaryDay,
  getNutritionProfile,
  historyDays,
  recentFoods,
  saveNutritionAnswers,
  updateEntryGrams,
} from "@/server/nutrition/diary";
import { exportMyData } from "@/server/profile/profile";
import {
  adminClient,
  createUser,
  grantAccess,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

function sofiaDay(offsetDays = 0): string {
  const d = new Date(`${sofiaToday()}T12:00:00Z`);
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

const oats = { name: "Овесена каша", grams: 200, kcal: 300, proteinG: 10, carbsG: 50, fatG: 6 };
const egg = { name: "Яйце", grams: 60, kcal: 90, proteinG: 7, carbsG: 1, fatG: 6 };

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to fail");
}

const ANSWERS = {
  birthYear: 1990,
  activity: "moderate" as const,
  diet: "vegetarian" as const,
  allergens: ["milk" as const, "nuts" as const],
  avoidFoods: "хапчета с мед",
  mealsPerDay: 4 as const,
};

describe("diary entries", () => {
  it("sums two batches on a day and keeps the meal and source", async () => {
    const { user, db } = await member("nut-sum");
    await addEntries(db, user.id, {
      day: sofiaDay(),
      meal: "breakfast",
      batchId: randomUUID(),
      source: "ai",
      items: [oats, egg],
    });
    await addEntries(db, user.id, {
      day: sofiaDay(),
      meal: "dinner",
      batchId: randomUUID(),
      source: "manual",
      items: [{ name: "Салата", grams: null, kcal: 120, proteinG: 0, carbsG: 0, fatG: 0 }],
    });
    const day = await getDiaryDay(db, user.id, sofiaDay());
    expect(day.entries).toHaveLength(3);
    expect(day.totals).toEqual({ kcal: 510, proteinG: 17, carbsG: 51, fatG: 12 });
    expect(day.entries.map((e) => e.name)).toEqual(["Овесена каша", "Яйце", "Салата"]);
    expect(day.entries[0]).toMatchObject({
      eatenOn: sofiaDay(),
      meal: "breakfast",
      grams: 200,
      source: "ai",
    });
    expect(day.entries[2]).toMatchObject({ meal: "dinner", grams: null, source: "manual" });
    expect(await getDiaryDay(db, user.id, sofiaDay(-1))).toEqual({
      entries: [],
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    });
  });

  it("a retried batch changes nothing, and two equal items in one batch both stay", async () => {
    const { user, db } = await member("nut-idem");
    const input = {
      day: sofiaDay(),
      meal: "lunch" as const,
      batchId: randomUUID(),
      source: "ai" as const,
      items: [egg, egg],
    };
    await addEntries(db, user.id, input);
    await addEntries(db, user.id, input);
    const day = await getDiaryDay(db, user.id, sofiaDay());
    expect(day.entries).toHaveLength(2);
    expect(day.totals.kcal).toBe(180);
  });

  it("a retried batch that filled the day to 100 is still a success", async () => {
    const { user, db } = await member("nut-idem-full");
    const day = sofiaDay(-1);
    const filler = Array.from({ length: 97 }, (_, i) => ({
      user_id: user.id,
      batch_id: randomUUID(),
      position: 0,
      eaten_on: day,
      meal: "snack" as const,
      name: `x${i}`,
      kcal: 1,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      source: "manual" as const,
    }));
    expect((await admin.from("food_entries").insert(filler)).error).toBeNull();
    const input = {
      day,
      meal: "lunch" as const,
      batchId: randomUUID(),
      source: "ai" as const,
      items: [egg, oats, egg],
    };
    await addEntries(db, user.id, input);
    await addEntries(db, user.id, input);
    expect((await getDiaryDay(db, user.id, day)).entries).toHaveLength(100);

    // A different batch on the full day is still refused.
    const other = await failure(addEntries(db, user.id, { ...input, batchId: randomUUID() }));
    expect(isAppError(other) && other.code).toBe("INVALID");
  });

  it("explains the date window and the daily cap with the database message", async () => {
    const { user, db } = await member("nut-limits");
    const future = await failure(
      addEntries(db, user.id, {
        day: sofiaDay(1),
        meal: "lunch",
        batchId: randomUUID(),
        source: "manual",
        items: [egg],
      }),
    );
    expect(isAppError(future) && future.code).toBe("INVALID");
    expect((future as Error).message).toBe("Датата трябва да е до днес.");

    const rows = Array.from({ length: 100 }, (_, i) => ({
      user_id: user.id,
      batch_id: randomUUID(),
      position: 0,
      eaten_on: sofiaDay(-1),
      meal: "snack" as const,
      name: `x${i}`,
      kcal: 1,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      source: "manual" as const,
    }));
    const seeded = await admin.from("food_entries").insert(rows);
    expect(seeded.error).toBeNull();
    const full = await failure(
      addEntries(db, user.id, {
        day: sofiaDay(-1),
        meal: "lunch",
        batchId: randomUUID(),
        source: "manual",
        items: [egg],
      }),
    );
    expect(isAppError(full) && full.code).toBe("INVALID");
    expect((full as Error).message).toBe("Достигна 100 записа за деня.");
  });

  it("a member without access cannot add", async () => {
    const { user, db } = await member("nut-noaccess", { access: false });
    const error = await failure(
      addEntries(db, user.id, {
        day: sofiaDay(),
        meal: "lunch",
        batchId: randomUUID(),
        source: "manual",
        items: [egg],
      }),
    );
    expect(isAppError(error) && error.code).toBe("FORBIDDEN");
    expect((await getDiaryDay(db, user.id, sofiaDay())).entries).toEqual([]);
  });

  it("updateEntryGrams rescales kcal and macros from the stored row", async () => {
    const { user, db } = await member("nut-grams");
    await addEntries(db, user.id, {
      day: sofiaDay(),
      meal: "breakfast",
      batchId: randomUUID(),
      source: "ai",
      items: [oats],
    });
    const [saved] = (await getDiaryDay(db, user.id, sofiaDay())).entries;
    await updateEntryGrams(db, saved.id, 100);
    const [half] = (await getDiaryDay(db, user.id, sofiaDay())).entries;
    expect(half).toMatchObject({ grams: 100, kcal: 150, proteinG: 5, carbsG: 25, fatG: 3 });

    const tooMuch = await failure(updateEntryGrams(db, saved.id, 5000));
    expect(isAppError(tooMuch) && tooMuch.code).toBe("INVALID");
    expect((tooMuch as Error).message).toBe("Количеството е извън допустимото.");
  });

  it("update and delete of someone else's or a missing entry are NOT_FOUND", async () => {
    const a = await member("nut-own");
    const b = await member("nut-other");
    await addEntries(a.db, a.user.id, {
      day: sofiaDay(),
      meal: "lunch",
      batchId: randomUUID(),
      source: "ai",
      items: [egg],
    });
    const [theirs] = (await getDiaryDay(a.db, a.user.id, sofiaDay())).entries;

    for (const call of [
      () => updateEntryGrams(b.db, theirs.id, 30),
      () => deleteEntry(b.db, theirs.id),
      () => deleteEntry(b.db, randomUUID()),
      () => deleteEntry(b.db, "not-a-uuid"),
    ]) {
      const error = await failure(call());
      expect(isAppError(error) && error.code).toBe("NOT_FOUND");
    }
    expect((await getDiaryDay(a.db, a.user.id, sofiaDay())).entries).toHaveLength(1);

    await deleteEntry(a.db, theirs.id);
    expect((await getDiaryDay(a.db, a.user.id, sofiaDay())).entries).toEqual([]);
  });
});

describe("recent foods and history", () => {
  it("recentFoods dedupes by name ignoring case, newest first, and honours the limit", async () => {
    const { user, db } = await member("nut-recent");
    const base = { meal: "lunch" as const, source: "ai" as const };
    await addEntries(db, user.id, {
      ...base,
      day: sofiaDay(-2),
      batchId: randomUUID(),
      items: [{ ...egg, name: "Яйце", kcal: 80 }],
    });
    await addEntries(db, user.id, {
      ...base,
      day: sofiaDay(-1),
      batchId: randomUUID(),
      items: [oats],
    });
    await addEntries(db, user.id, {
      ...base,
      day: sofiaDay(),
      batchId: randomUUID(),
      items: [{ ...egg, name: "яйце", kcal: 95 }],
    });
    const recent = await recentFoods(db, user.id);
    expect(recent.map((r) => r.name)).toEqual(["яйце", "Овесена каша"]);
    expect(recent[0]).toEqual({
      name: "яйце",
      grams: 60,
      kcal: 95,
      proteinG: 7,
      carbsG: 1,
      fatG: 6,
    });
    expect(await recentFoods(db, user.id, 1)).toHaveLength(1);
  });

  it("historyDays returns exactly 30 zero-filled days, oldest first, with sums and counts", async () => {
    const { user, db } = await member("nut-history");
    await addEntries(db, user.id, {
      day: sofiaDay(-3),
      meal: "lunch",
      batchId: randomUUID(),
      source: "ai",
      items: [oats, egg],
    });
    await addEntries(db, user.id, {
      day: sofiaDay(),
      meal: "dinner",
      batchId: randomUUID(),
      source: "ai",
      items: [egg],
    });
    // Outside the 30-day window: must not show.
    await addEntries(db, user.id, {
      day: sofiaDay(-30),
      meal: "dinner",
      batchId: randomUUID(),
      source: "ai",
      items: [egg],
    });
    const history = await historyDays(db, user.id, sofiaDay());
    expect(history).toHaveLength(30);
    expect(history[0]).toEqual({ day: sofiaDay(-29), kcal: 0, count: 0 });
    expect(history[29]).toEqual({ day: sofiaDay(), kcal: 90, count: 1 });
    expect(history[26]).toEqual({ day: sofiaDay(-3), kcal: 390, count: 2 });
    expect(history.reduce((s, d) => s + d.count, 0)).toBe(3);
    const days = history.map((d) => d.day);
    expect([...days].sort()).toEqual(days);
  });

  it("historyDays and the export read past the 1000-row page limit", async () => {
    const { user, db } = await member("nut-many");
    // 11 days x 95 rows = 1045 rows, more than one PostgREST page.
    const rows = [];
    for (let d = 0; d < 11; d += 1) {
      for (let i = 0; i < 95; i += 1) {
        rows.push({
          user_id: user.id,
          batch_id: randomUUID(),
          position: 0,
          eaten_on: sofiaDay(-d),
          meal: "snack" as const,
          name: `bulk ${d}-${i}`,
          kcal: 2,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          source: "manual" as const,
        });
      }
    }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("food_entries").insert(rows.slice(i, i + 500));
      expect(error).toBeNull();
    }
    const history = await historyDays(db, user.id, sofiaDay());
    expect(history.reduce((s, d) => s + d.count, 0)).toBe(1045);
    expect(history[29]).toEqual({ day: sofiaDay(), kcal: 190, count: 95 });

    const exported = await exportMyData(db, user.id, admin);
    expect(exported.food_entries as unknown[]).toHaveLength(1045);
  });
});

describe("nutrition profile", () => {
  it("is empty before answering, then returns the answers and a target", async () => {
    const { user, db } = await member("nut-profile");
    await admin
      .from("profiles")
      .update({ height_cm: 165, weight_kg: 70, goal: "lose_weight" })
      .eq("id", user.id);
    const before = await getNutritionProfile(db, user.id);
    expect(before).toMatchObject({ answers: null, target: null, hasAccess: true });

    await saveNutritionAnswers(db, user.id, ANSWERS);
    const after = await getNutritionProfile(db, user.id);
    expect(after.answers).toEqual(ANSWERS);
    expect(after.target).toEqual(
      calorieTarget({
        weightKg: 70,
        heightCm: 165,
        birthYear: 1990,
        activity: "moderate",
        goal: "lose_weight",
        today: sofiaToday(),
      }),
    );
    const { data } = await admin
      .from("profiles")
      .select("nutrition_answered_at, diet, allergens")
      .eq("id", user.id)
      .single();
    expect(data?.nutrition_answered_at).not.toBeNull();
    expect(data).toMatchObject({ diet: "vegetarian", allergens: ["milk", "nuts"] });
  });

  it("uses the latest check-in weight over the profile weight", async () => {
    const { user, db } = await member("nut-weight");
    await admin
      .from("profiles")
      .update({ height_cm: 165, weight_kg: 90, goal: "tone" })
      .eq("id", user.id);
    await admin.from("check_ins").insert([
      { user_id: user.id, weight_kg: 80, created_at: "2026-01-01T10:00:00Z" },
      { user_id: user.id, weight_kg: 66, created_at: "2026-02-01T10:00:00Z" },
      // The newest check-in has no weight: it must not hide the last weighed one.
      { user_id: user.id, waist_cm: 70, created_at: "2026-03-01T10:00:00Z" },
    ]);
    await saveNutritionAnswers(db, user.id, ANSWERS);
    const { target } = await getNutritionProfile(db, user.id);
    expect(target).toEqual(
      calorieTarget({
        weightKg: 66,
        heightCm: 165,
        birthYear: 1990,
        activity: "moderate",
        goal: "tone",
        today: sofiaToday(),
      }),
    );
  });

  it("target is null while height is missing, and hasAccess is false without a subscription", async () => {
    const { user, db } = await member("nut-notarget", { access: false });
    const profile = await getNutritionProfile(db, user.id);
    expect(profile).toEqual({ answers: null, target: null, hasAccess: false });
  });

  it("rejects invalid answers", async () => {
    const { user, db } = await member("nut-bad");
    const young = await failure(
      saveNutritionAnswers(db, user.id, { ...ANSWERS, birthYear: new Date().getFullYear() - 10 }),
    );
    expect(isAppError(young) && young.code).toBe("INVALID");
  });

  it("saves answers without access (onboarding comes before payment)", async () => {
    const none = await member("nut-answers-noaccess", { access: false });
    await saveNutritionAnswers(none.db, none.user.id, ANSWERS);
    const { data } = await admin
      .from("profiles")
      .select("nutrition_answered_at, diet")
      .eq("id", none.user.id)
      .single();
    expect(data?.nutrition_answered_at).not.toBeNull();
    expect(data?.diet).toBe("vegetarian");
  });

  it("answers for an unknown member are NOT_FOUND", async () => {
    const { db } = await member("nut-answers-unknown");
    const error = await failure(saveNutritionAnswers(db, randomUUID(), ANSWERS));
    expect(isAppError(error) && error.code).toBe("NOT_FOUND");
  });
});

describe("export", () => {
  it("contains her food entries (oldest first, no user id) and the nutrition answers", async () => {
    const { user, db } = await member("nut-export");
    const other = await member("nut-export-other");
    await saveNutritionAnswers(db, user.id, ANSWERS);
    await addEntries(db, user.id, {
      day: sofiaDay(),
      meal: "dinner",
      batchId: randomUUID(),
      source: "manual",
      items: [egg],
    });
    await addEntries(db, user.id, {
      day: sofiaDay(-2),
      meal: "breakfast",
      batchId: randomUUID(),
      source: "ai",
      items: [oats],
    });
    await addEntries(other.db, other.user.id, {
      day: sofiaDay(),
      meal: "lunch",
      batchId: randomUUID(),
      source: "ai",
      items: [egg],
    });
    const data = await exportMyData(db, user.id, admin);
    expect(data.profile).toMatchObject({
      diet: "vegetarian",
      activity_level: "moderate",
      birth_year: 1990,
      allergens: ["milk", "nuts"],
      avoid_foods: "хапчета с мед",
      meals_per_day: 4,
    });
    expect((data.profile as Record<string, unknown>).nutrition_answered_at).toEqual(
      expect.any(String),
    );
    const entries = data.food_entries as Record<string, unknown>[];
    expect(entries.map((e) => e.name)).toEqual(["Овесена каша", "Яйце"]);
    expect(entries[0]).toMatchObject({
      eaten_on: sofiaDay(-2),
      meal: "breakfast",
      grams: 200,
      kcal: 300,
      source: "ai",
    });
    for (const e of entries) expect(e).not.toHaveProperty("user_id");
  });
});
