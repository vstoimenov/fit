import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  draft: vi.fn(),
  createClaudeMealDrafter: vi.fn(),
  requireAdmin: vi.fn(),
  env: {
    ANTHROPIC_API_KEY: "sk-ant-test" as string | undefined,
    NUTRITION_AI_MODEL: undefined as string | undefined,
  },
}));

vi.mock("@/env", () => ({ serverEnv: mocks.env }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/admin/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/nutrition/meal-drafter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/nutrition/meal-drafter")>()),
  createClaudeMealDrafter: mocks.createClaudeMealDrafter,
}));

import { AppError } from "@/lib/app-error";
import { MealDraftFailed } from "@/server/nutrition/meal-drafter";
import { draftMealAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ANTHROPIC_API_KEY = "sk-ant-test";
  mocks.env.NUTRITION_AI_MODEL = undefined;
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.requireAdmin.mockResolvedValue({ supabase: { rpc: mocks.rpc }, user: { id: "a1" } });
  mocks.draft.mockResolvedValue({ kcal: 400 });
  mocks.createClaudeMealDrafter.mockReturnValue({ draft: mocks.draft });
});

describe("draftMealAction", () => {
  it("claims one draft, calls the drafter with the default model and returns the draft", async () => {
    const result = await draftMealAction("Овесена каша", "с мляко");
    expect(result).toEqual({ ok: true, data: { draft: { kcal: 400 } } });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_meal_draft_call");
    expect(mocks.createClaudeMealDrafter).toHaveBeenCalledWith({
      apiKey: "sk-ant-test",
      model: "claude-opus-5-5",
    });
    expect(mocks.draft).toHaveBeenCalledWith("Овесена каша", "с мляко");
  });

  it("uses NUTRITION_AI_MODEL when set", async () => {
    mocks.env.NUTRITION_AI_MODEL = "claude-test-model";
    await draftMealAction("Овесена каша", "");
    expect(mocks.createClaudeMealDrafter).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-test-model" }),
    );
  });

  it("says the helper is not on yet and burns no quota without a key", async () => {
    mocks.env.ANTHROPIC_API_KEY = undefined;
    expect(await draftMealAction("Овесена каша", "")).toEqual({
      ok: false,
      message: "AI помощникът скоро ще е включен.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.draft).not.toHaveBeenCalled();
  });

  it("reports the daily limit when the claim is refused and does not call the model", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await draftMealAction("Овесена каша", "")).toEqual({
      ok: false,
      message: "Днес достигнахте лимита за AI предложения.",
    });
    expect(mocks.draft).not.toHaveBeenCalled();
  });

  it("rejects a short title or long notes before claiming", async () => {
    for (const [title, notes] of [
      ["а", ""],
      ["Каша", "x".repeat(1001)],
    ]) {
      const result = await draftMealAction(title, notes);
      expect(result.ok).toBe(false);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("turns a failed draft into a friendly message", async () => {
    mocks.draft.mockRejectedValue(new MealDraftFailed("Claude refused"));
    expect(await draftMealAction("Овесена каша", "")).toEqual({
      ok: false,
      message: "Не успяхме да направим предложение. Опитай пак или попълни ръчно.",
    });
  });

  it("refuses a non-admin", async () => {
    mocks.requireAdmin.mockRejectedValue(new AppError("FORBIDDEN", "Нямаш достъп."));
    expect(await draftMealAction("Овесена каша", "")).toEqual({
      ok: false,
      message: "Нямаш достъп.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
