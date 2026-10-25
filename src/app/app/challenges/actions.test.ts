import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "5d10a436-118c-4a7f-9910-4d92197ac74b";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
  joinChallenge: vi.fn(),
  setTick: vi.fn(),
  setBoardVisibility: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/auth/require-user", () => ({
  requireUser: async () => ({ user: { id: "user-1" }, supabase: { rpc: mocks.rpc } }),
}));
vi.mock("@/server/challenges/challenges", () => ({
  joinChallenge: mocks.joinChallenge,
  setTick: mocks.setTick,
  setBoardVisibility: mocks.setBoardVisibility,
}));

import { joinChallengeAction, setBoardVisibilityAction, toggleTickAction } from "./actions";

const NO_ACCESS = "Нужен е активен абонамент.";

describe("challenge actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("joins and revalidates the list, the detail page and home", async () => {
    expect(await joinChallengeAction(ID)).toEqual({ ok: true, data: null });
    expect(mocks.joinChallenge).toHaveBeenCalledWith({ rpc: mocks.rpc }, ID);
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/app/challenges"],
      ["/app/challenges/[id]", "page"],
      ["/app"],
    ]);
  });

  it("refuses join and tick without an active plan, before touching the service", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await joinChallengeAction(ID)).toEqual({ ok: false, message: NO_ACCESS });
    expect(await toggleTickAction({ id: ID, day: 2, done: true })).toEqual({
      ok: false,
      message: NO_ACCESS,
    });
    expect(mocks.joinChallenge).not.toHaveBeenCalled();
    expect(mocks.setTick).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed input", async () => {
    expect(await joinChallengeAction("nope")).toMatchObject({ ok: false });
    for (const day of [0, 61, 1.5, Number.NaN]) {
      expect(await toggleTickAction({ id: ID, day, done: true })).toMatchObject({
        ok: false,
        message: "Невалиден ден.",
      });
    }
    expect(await toggleTickAction({ id: ID, day: 2, done: "yes" as never })).toMatchObject({
      ok: false,
    });
    expect(mocks.setTick).not.toHaveBeenCalled();
  });

  it("passes a valid tick to the service with her id and reports the points", async () => {
    mocks.setTick.mockResolvedValueOnce({ points: false });
    expect(await toggleTickAction({ id: ID, day: 3, done: false })).toEqual({
      ok: true,
      data: { points: false },
    });
    mocks.setTick.mockResolvedValueOnce({ points: true });
    expect(await toggleTickAction({ id: ID, day: 3, done: true })).toEqual({
      ok: true,
      data: { points: true },
    });
    expect(mocks.setTick).toHaveBeenCalledWith({ rpc: mocks.rpc }, "user-1", {
      id: ID,
      day: 3,
      done: false,
    });
  });

  it("changes board visibility without an access check", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await setBoardVisibilityAction({ id: ID, show: false })).toEqual({
      ok: true,
      data: null,
    });
    expect(mocks.setBoardVisibility).toHaveBeenCalledWith({ rpc: mocks.rpc }, "user-1", {
      id: ID,
      show: false,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
