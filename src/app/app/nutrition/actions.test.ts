import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  saveNutritionAnswers: vi.fn(),
  addEntries: vi.fn(),
  updateEntryGrams: vi.fn(),
  deleteEntry: vi.fn(),
  revalidatePath: vi.fn(),
  estimate: vi.fn(),
  createClaudeEstimator: vi.fn(),
  env: {
    ANTHROPIC_API_KEY: "sk-ant-test" as string | undefined,
    NUTRITION_AI_MODEL: undefined as string | undefined,
  },
}));

vi.mock("@/env", () => ({ serverEnv: mocks.env }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/nutrition/diary", () => ({
  saveNutritionAnswers: mocks.saveNutritionAnswers,
  addEntries: mocks.addEntries,
  updateEntryGrams: mocks.updateEntryGrams,
  deleteEntry: mocks.deleteEntry,
}));
vi.mock("@/server/auth/require-user", () => ({
  requireUser: async () => ({ supabase: { rpc: mocks.rpc }, user: { id: "u1" } }),
}));
vi.mock("@/server/nutrition/estimator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/nutrition/estimator")>()),
  createClaudeEstimator: mocks.createClaudeEstimator,
}));

import { EstimateFailed } from "@/server/nutrition/estimator";
import { AppError } from "@/lib/app-error";
import { shiftDay } from "@/lib/nutrition/day-param";
import { sofiaToday } from "@/lib/progress-photos/today";
import {
  addManualEntry,
  deleteEntryAction,
  estimateFood,
  saveEstimate,
  saveNutritionAnswersAction,
  updateEntry,
} from "./actions";

const item = { name: "Хляб", grams: 60, kcal: 150, proteinG: 5, carbsG: 28, fatG: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ANTHROPIC_API_KEY = "sk-ant-test";
  mocks.env.NUTRITION_AI_MODEL = undefined;
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.saveNutritionAnswers.mockResolvedValue(undefined);
  mocks.addEntries.mockResolvedValue(undefined);
  mocks.updateEntryGrams.mockResolvedValue(undefined);
  mocks.deleteEntry.mockResolvedValue(undefined);
  mocks.estimate.mockResolvedValue([item]);
  mocks.createClaudeEstimator.mockReturnValue({ estimate: mocks.estimate });
});

describe("estimateFood", () => {
  it("returns the estimated items and uses the default model", async () => {
    const result = await estimateFood({ text: "  две филии хляб " });
    expect(result).toEqual({ ok: true, data: { items: [item] } });
    expect(mocks.estimate).toHaveBeenCalledWith("две филии хляб");
    expect(mocks.createClaudeEstimator).toHaveBeenCalledWith({
      apiKey: "sk-ant-test",
      model: "claude-opus-5-5",
    });
  });

  it("uses NUTRITION_AI_MODEL when set", async () => {
    mocks.env.NUTRITION_AI_MODEL = "claude-haiku-5-5";
    await estimateFood({ text: "хляб" });
    expect(mocks.createClaudeEstimator).toHaveBeenCalledWith({
      apiKey: "sk-ant-test",
      model: "claude-haiku-5-5",
    });
  });

  it("rejects too short or too long text without spending quota", async () => {
    for (const text of ["x", "   ", "я".repeat(301)]) {
      expect(await estimateFood({ text })).toEqual({
        ok: false,
        message: "Опиши храната с няколко думи.",
      });
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.estimate).not.toHaveBeenCalled();
  });

  it("says the feature is coming soon when there is no API key, without spending quota", async () => {
    mocks.env.ANTHROPIC_API_KEY = undefined;
    expect(await estimateFood({ text: "хляб" })).toEqual({
      ok: false,
      message: "Изчисляването с думи скоро ще е включено.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("shows the limit copy when the quota claim is refused", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await estimateFood({ text: "хляб" })).toEqual({
      ok: false,
      message: "Днес достигна лимита за изчисления. Въведи ръчно.",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_nutrition_ai_call");
    expect(mocks.estimate).not.toHaveBeenCalled();
  });

  it("shows the failure copy when the estimator fails", async () => {
    mocks.estimate.mockRejectedValue(new EstimateFailed("timeout"));
    expect(await estimateFood({ text: "хляб" })).toEqual({
      ok: false,
      message: "Не успяхме да изчислим. Опитай пак или въведи ръчно.",
    });
  });

  it("returns a generic failure when the quota RPC errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    const result = await estimateFood({ text: "хляб" });
    expect(result.ok).toBe(false);
    expect(mocks.estimate).not.toHaveBeenCalled();
  });

  it("returns the generic message, never raw error text, for unexpected errors", async () => {
    const generic = { ok: false, message: "Нещо се обърка. Опитай отново." };
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.estimate.mockRejectedValue(new Error("secret internal detail"));
    expect(await estimateFood({ text: "хляб" })).toEqual(generic);
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    expect(await estimateFood({ text: "хляб" })).toEqual(generic);
  });
});

function answersForm(patch: Record<string, string | string[]> = {}): FormData {
  const fields: Record<string, string | string[]> = {
    birthYear: "1990",
    activity: "light",
    diet: "vegetarian",
    allergens: ["milk", "nuts"],
    avoidFoods: " сьомга ",
    mealsPerDay: "4",
    ...patch,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields))
    for (const v of Array.isArray(value) ? value : [value]) form.append(key, v);
  return form;
}

describe("saveNutritionAnswersAction", () => {
  it("saves the parsed answers for the signed-in member and refreshes profile and diary", async () => {
    expect(await saveNutritionAnswersAction(answersForm())).toEqual({ ok: true, data: null });
    expect(mocks.saveNutritionAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: mocks.rpc }),
      "u1",
      {
        birthYear: 1990,
        activity: "light",
        diet: "vegetarian",
        allergens: ["milk", "nuts"],
        avoidFoods: "сьомга",
        mealsPerDay: 4,
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/profile");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/nutrition");
  });

  it("does not check access: lapsed members may correct their answers", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await saveNutritionAnswersAction(answersForm())).ok).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid answers with a message on the field and writes nothing", async () => {
    const result = await saveNutritionAnswersAction(answersForm({ birthYear: "1939" }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.fieldErrors?.birthYear).toMatch(/1940/);
    expect((await saveNutritionAnswersAction(answersForm({ allergens: ["pollen"] }))).ok).toBe(
      false,
    );
    expect((await saveNutritionAnswersAction(answersForm({ activity: "" }))).ok).toBe(false);
    expect(mocks.saveNutritionAnswers).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("passes on the service's own message", async () => {
    mocks.saveNutritionAnswers.mockRejectedValue(
      new AppError("NOT_FOUND", "Профилът не е намерен."),
    );
    expect(await saveNutritionAnswersAction(answersForm())).toEqual({
      ok: false,
      message: "Профилът не е намерен.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

const BATCH = "0b9a3c1e-5d0f-4c6e-9f43-3e5f1f6f8a11";
const ENTRY = "7d2f6a54-1c1e-4a39-8f7a-52a1d1f0c9b2";
const NO_ACCESS = "Нужен е активен абонамент.";

function manualInput(patch: Record<string, unknown> = {}) {
  return {
    day: sofiaToday(),
    meal: "lunch",
    batchId: BATCH,
    name: "  Баница ",
    kcal: 320,
    ...patch,
  } as Parameters<typeof addManualEntry>[0];
}

describe("addManualEntry", () => {
  it("saves one manual entry with missing macros as 0 and refreshes the diary and Начало", async () => {
    expect(await addManualEntry(manualInput({ proteinG: 7.5 }))).toEqual({ ok: true, data: null });
    expect(mocks.rpc).toHaveBeenCalledWith("my_access");
    expect(mocks.addEntries).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: mocks.rpc }),
      "u1",
      {
        day: sofiaToday(),
        meal: "lunch",
        batchId: BATCH,
        source: "manual",
        items: [{ name: "Баница", grams: null, kcal: 320, proteinG: 7.5, carbsG: 0, fatG: 0 }],
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/nutrition");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("accepts the oldest allowed day and rejects invalid, future and older days", async () => {
    const today = sofiaToday();
    expect((await addManualEntry(manualInput({ day: shiftDay(today, -365) }))).ok).toBe(true);
    mocks.addEntries.mockClear();
    for (const day of [shiftDay(today, 1), shiftDay(today, -366), "bad", "2026-02-30", undefined]) {
      expect(await addManualEntry(manualInput({ day }))).toEqual({
        ok: false,
        message: "Невалиден ден.",
      });
    }
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });

  it("answers with the plan message and writes nothing without access", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await addManualEntry(manualInput())).toEqual({ ok: false, message: NO_ACCESS });
    expect(mocks.addEntries).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects bad input with a message on the field", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ name: "   " }, "name"],
      [{ name: "а".repeat(121) }, "name"],
      [{ kcal: 5001 }, "kcal"],
      [{ kcal: 80.5 }, "kcal"],
      [{ kcal: "80" }, "kcal"],
      [{ kcal: -1 }, "kcal"],
      [{ fatG: 1001 }, "fatG"],
      [{ carbsG: -1 }, "carbsG"],
    ];
    for (const [patch, field] of cases) {
      const result = await addManualEntry(manualInput(patch));
      expect(result.ok).toBe(false);
      expect(!result.ok && result.fieldErrors?.[field]).toBeTruthy();
    }
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });

  it("rejects an unknown meal and a batch id that is not a uuid", async () => {
    expect((await addManualEntry(manualInput({ meal: "brunch" }))).ok).toBe(false);
    expect((await addManualEntry(manualInput({ batchId: "x" }))).ok).toBe(false);
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });

  it("passes on the service's own message (date window, 100 per day)", async () => {
    mocks.addEntries.mockRejectedValue(new AppError("INVALID", "Най-много 100 записа на ден."));
    expect(await addManualEntry(manualInput())).toEqual({
      ok: false,
      message: "Най-много 100 записа на ден.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("fails generically when the access check errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    expect(await addManualEntry(manualInput())).toEqual({
      ok: false,
      message: "Нещо се обърка. Опитай отново.",
    });
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });
});

describe("updateEntry", () => {
  it("rescales through the service and refreshes", async () => {
    expect(await updateEntry({ id: ENTRY, grams: 150 })).toEqual({ ok: true, data: null });
    expect(mocks.updateEntryGrams).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: mocks.rpc }),
      ENTRY,
      150,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/nutrition");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("rejects a bad id or amount before touching the database", async () => {
    for (const input of [
      { id: "x", grams: 150 },
      { id: ENTRY, grams: Number.NaN },
      { id: ENTRY, grams: Number.POSITIVE_INFINITY },
      { id: ENTRY, grams: "150" },
    ]) {
      expect((await updateEntry(input as never)).ok).toBe(false);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.updateEntryGrams).not.toHaveBeenCalled();
  });

  it("answers with the plan message without access", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await updateEntry({ id: ENTRY, grams: 150 })).toEqual({ ok: false, message: NO_ACCESS });
    expect(mocks.updateEntryGrams).not.toHaveBeenCalled();
  });

  it("passes on the service message when the amount is out of bounds", async () => {
    mocks.updateEntryGrams.mockRejectedValue(
      new AppError("INVALID", "Количеството е извън допустимото."),
    );
    expect(await updateEntry({ id: ENTRY, grams: 5000 })).toEqual({
      ok: false,
      message: "Количеството е извън допустимото.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteEntryAction", () => {
  it("deletes and refreshes", async () => {
    expect(await deleteEntryAction({ id: ENTRY })).toEqual({ ok: true, data: null });
    expect(mocks.deleteEntry).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: mocks.rpc }),
      ENTRY,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/nutrition");
  });

  it("rejects a bad id and answers with the plan message without access", async () => {
    expect((await deleteEntryAction({ id: "nope" })).ok).toBe(false);
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await deleteEntryAction({ id: ENTRY })).toEqual({ ok: false, message: NO_ACCESS });
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
  });
});

function estimateInput(patch: Record<string, unknown> = {}) {
  return {
    day: sofiaToday(),
    meal: "dinner",
    batchId: BATCH,
    source: "ai",
    items: [
      item,
      { name: " Салата ", grams: 250, kcal: 300, proteinG: 30, carbsG: 10.5, fatG: 15 },
    ],
    ...patch,
  } as Parameters<typeof saveEstimate>[0];
}

describe("saveEstimate", () => {
  it("saves all rows in order as one batch and refreshes the diary and Начало", async () => {
    expect(await saveEstimate(estimateInput())).toEqual({ ok: true, data: null });
    expect(mocks.rpc).toHaveBeenCalledWith("my_access");
    expect(mocks.addEntries).toHaveBeenCalledWith(
      expect.objectContaining({ rpc: mocks.rpc }),
      "u1",
      {
        day: sofiaToday(),
        meal: "dinner",
        batchId: BATCH,
        source: "ai",
        items: [
          item,
          { name: "Салата", grams: 250, kcal: 300, proteinG: 30, carbsG: 10.5, fatG: 15 },
        ],
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/nutrition");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("accepts a quick-add (recent) entry without an amount", async () => {
    const recent = { name: "Баница", grams: null, kcal: 320, proteinG: 7, carbsG: 30, fatG: 18 };
    expect((await saveEstimate(estimateInput({ source: "recent", items: [recent] }))).ok).toBe(
      true,
    );
    expect(mocks.addEntries).toHaveBeenCalledWith(expect.anything(), "u1", {
      day: sofiaToday(),
      meal: "dinner",
      batchId: BATCH,
      source: "recent",
      items: [recent],
    });
  });

  it("accepts values on the database bounds", async () => {
    const edge = {
      name: "а".repeat(120),
      grams: 2000,
      kcal: 5000,
      proteinG: 1000,
      carbsG: 0,
      fatG: 1000,
    };
    const low = { name: "x", grams: 1, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    expect((await saveEstimate(estimateInput({ items: [edge, low] }))).ok).toBe(true);
    const twelve = Array.from({ length: 12 }, () => item);
    expect((await saveEstimate(estimateInput({ items: twelve }))).ok).toBe(true);
  });

  it("accepts the oldest allowed day and rejects invalid, future and older days", async () => {
    const today = sofiaToday();
    expect((await saveEstimate(estimateInput({ day: shiftDay(today, -365) }))).ok).toBe(true);
    mocks.addEntries.mockClear();
    for (const day of [shiftDay(today, 1), shiftDay(today, -366), "bad", "2026-02-30", undefined]) {
      expect(await saveEstimate(estimateInput({ day }))).toEqual({
        ok: false,
        message: "Невалиден ден.",
      });
    }
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });

  it("answers with the plan message and writes nothing without access", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await saveEstimate(estimateInput())).toEqual({ ok: false, message: NO_ACCESS });
    expect(mocks.addEntries).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects bad rows and writes nothing", async () => {
    const bad: Record<string, unknown>[] = [
      { name: "   " },
      { name: "а".repeat(121) },
      { grams: 0 },
      { grams: 0.5 },
      { grams: 2001 },
      { grams: "100" },
      { kcal: 5001 },
      { kcal: -1 },
      { kcal: 80.5 },
      { kcal: Number.NaN },
      { proteinG: 1001 },
      { carbsG: -0.1 },
      { fatG: Number.POSITIVE_INFINITY },
      { fatG: undefined },
    ];
    for (const patch of bad) {
      const result = await saveEstimate(estimateInput({ items: [{ ...item, ...patch }] }));
      expect(result.ok, JSON.stringify(patch)).toBe(false);
    }
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });

  it("rejects no rows, more than 12 rows and rows that are not a list", async () => {
    expect((await saveEstimate(estimateInput({ items: [] }))).ok).toBe(false);
    expect(
      (await saveEstimate(estimateInput({ items: Array.from({ length: 13 }, () => item) }))).ok,
    ).toBe(false);
    expect((await saveEstimate(estimateInput({ items: null }))).ok).toBe(false);
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });

  it("rejects an unknown meal or source and a batch id that is not a uuid", async () => {
    expect((await saveEstimate(estimateInput({ meal: "brunch" }))).ok).toBe(false);
    expect((await saveEstimate(estimateInput({ source: "manual" }))).ok).toBe(false);
    expect((await saveEstimate(estimateInput({ source: "menu" }))).ok).toBe(false);
    expect((await saveEstimate(estimateInput({ batchId: "x" }))).ok).toBe(false);
    expect(mocks.addEntries).not.toHaveBeenCalled();
  });

  it("passes on the service's own message (date window, 100 per day)", async () => {
    mocks.addEntries.mockRejectedValue(new AppError("INVALID", "Най-много 100 записа на ден."));
    expect(await saveEstimate(estimateInput())).toEqual({
      ok: false,
      message: "Най-много 100 записа на ден.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
