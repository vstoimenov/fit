import { describe, expect, it, vi } from "vitest";
import { isAppError } from "@/lib/app-error";
import type { TypedClient } from "@/server/db/types";
import {
  isWatched,
  isWatchedOrFalse,
  listWatchedIds,
  listWatchedIdsOrEmpty,
  setWatched,
} from "./watches";

type Result = { data: unknown; error: { code?: string; message: string } | null };

/** Records the chain a query built and answers it with `result`. */
function fakeDb(result: Result, calls: string[] = []) {
  const chain: Record<string, unknown> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(",")})`);
      return chain;
    };
  for (const name of ["from", "select", "insert", "delete", "eq", "maybeSingle"]) {
    chain[name] = record(name);
  }
  chain.then = (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve);
  return { db: chain as unknown as TypedClient, calls };
}

describe("setWatched", () => {
  it("inserts the mark and ignores a duplicate", async () => {
    const fresh = fakeDb({ data: null, error: null });
    await setWatched(fresh.db, "w1", true);
    expect(fresh.calls).toEqual(['from("workout_watches")', 'insert({"workout_id":"w1"})']);
    const dup = fakeDb({ data: null, error: { code: "23505", message: "duplicate" } });
    await expect(setWatched(dup.db, "w1", true)).resolves.toBeUndefined();
  });

  it("explains a locked workout instead of a bare error", async () => {
    const { db } = fakeDb({ data: null, error: { code: "42501", message: "rls" } });
    const error = await setWatched(db, "w1", true).catch((e: unknown) => e);
    expect(isAppError(error) && error.code).toBe("FORBIDDEN");
  });

  it("removes the mark", async () => {
    const { db, calls } = fakeDb({ data: null, error: null });
    await setWatched(db, "w1", false);
    expect(calls).toEqual(['from("workout_watches")', "delete()", 'eq("workout_id","w1")']);
  });

  it("throws on other failures", async () => {
    const { db } = fakeDb({ data: null, error: { message: "boom" } });
    await expect(setWatched(db, "w1", false)).rejects.toThrow("unwatch failed: boom");
  });
});

describe("listWatchedIds / isWatched", () => {
  it("returns the member's own marks as a set", async () => {
    const { db, calls } = fakeDb({ data: [{ workout_id: "a" }, { workout_id: "b" }], error: null });
    expect(await listWatchedIds(db, "u")).toEqual(new Set(["a", "b"]));
    expect(calls).toContain('eq("user_id","u")');
  });

  it("answers one workout", async () => {
    const yes = fakeDb({ data: { workout_id: "a" }, error: null });
    expect(await isWatched(yes.db, "u", "a")).toBe(true);
    expect(yes.calls).toEqual(
      expect.arrayContaining(['eq("user_id","u")', 'eq("workout_id","a")', "maybeSingle()"]),
    );
    const no = fakeDb({ data: null, error: null });
    expect(await isWatched(no.db, "u", "a")).toBe(false);
  });
});

describe("degrading reads", () => {
  it("fall back to nothing watched when the read fails, so the page still renders", async () => {
    const broken = fakeDb({ data: null, error: { message: "boom" } });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await listWatchedIdsOrEmpty(broken.db, "u")).toEqual(new Set());
    expect(await isWatchedOrFalse(broken.db, "u", "a")).toBe(false);
    expect(quiet).toHaveBeenCalledTimes(2);
    quiet.mockRestore();
  });
});
