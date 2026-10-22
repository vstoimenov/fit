import { describe, expect, it } from "vitest";
import type { TypedClient } from "@/server/db/types";
import { getMemberPoints } from "./points";

const rpcReturning = (result: { data: unknown; error: { message: string } | null }) =>
  ({ rpc: async () => result }) as unknown as TypedClient;

describe("getMemberPoints", () => {
  it("returns the points and level of the row", async () => {
    const db = rpcReturning({ data: [{ points: 140, level: 3 }], error: null });
    expect(await getMemberPoints(db, "u")).toEqual({ points: 140, level: 3 });
  });

  it("throws when the rpc returns no row", async () => {
    await expect(getMemberPoints(rpcReturning({ data: [], error: null }), "u")).rejects.toThrow(
      "load points failed: no row",
    );
  });

  it("throws when the read fails", async () => {
    await expect(
      getMemberPoints(rpcReturning({ data: null, error: { message: "boom" } }), "u"),
    ).rejects.toThrow("load member points failed: boom");
  });
});
