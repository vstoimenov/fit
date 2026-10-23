import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  saveNutritionAnswers: vi.fn(),
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
vi.mock("@/server/nutrition/diary", () => ({ saveNutritionAnswers: mocks.saveNutritionAnswers }));
vi.mock("@/server/auth/require-user", () => ({
  requireUser: async () => ({ supabase: { rpc: mocks.rpc }, user: { id: "u1" } }),
}));
vi.mock("@/server/nutrition/estimator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/nutrition/estimator")>()),
  createClaudeEstimator: mocks.createClaudeEstimator,
}));

import { EstimateFailed } from "@/server/nutrition/estimator";
import { AppError } from "@/lib/app-error";
import { estimateFood, saveNutritionAnswersAction } from "./actions";

const item = { name: "Хляб", grams: 60, kcal: 150, proteinG: 5, carbsG: 28, fatG: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ANTHROPIC_API_KEY = "sk-ant-test";
  mocks.env.NUTRITION_AI_MODEL = undefined;
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.saveNutritionAnswers.mockResolvedValue(undefined);
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
