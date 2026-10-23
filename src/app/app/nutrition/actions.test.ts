import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  estimate: vi.fn(),
  createClaudeEstimator: vi.fn(),
  env: {
    ANTHROPIC_API_KEY: "sk-ant-test" as string | undefined,
    NUTRITION_AI_MODEL: undefined as string | undefined,
  },
}));

vi.mock("@/env", () => ({ serverEnv: mocks.env }));
vi.mock("@/server/auth/require-user", () => ({
  requireUser: async () => ({ supabase: { rpc: mocks.rpc }, user: { id: "u1" } }),
}));
vi.mock("@/server/nutrition/estimator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/nutrition/estimator")>()),
  createClaudeEstimator: mocks.createClaudeEstimator,
}));

import { EstimateFailed } from "@/server/nutrition/estimator";
import { estimateFood } from "./actions";

const item = { name: "Хляб", grams: 60, kcal: 150, proteinG: 5, carbsG: 28, fatG: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.ANTHROPIC_API_KEY = "sk-ant-test";
  mocks.env.NUTRITION_AI_MODEL = undefined;
  mocks.rpc.mockResolvedValue({ data: true, error: null });
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
});
