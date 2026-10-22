import { beforeAll, describe, expect, it } from "vitest";
import { LEVEL_THRESHOLDS, levelForPoints } from "@/lib/points/levels";
import { adminClient, type TypedClient } from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

function samples(): number[] {
  const set = new Set<number>([-20, -1]);
  for (let p = 0; p <= 1700; p += 10) set.add(p);
  for (const t of LEVEL_THRESHOLDS) {
    set.add(t - 1);
    set.add(t);
    set.add(t + 1);
  }
  set.add(5000);
  return [...set].sort((a, b) => a - b);
}

describe("levelForPoints parity with public.level_for_points", () => {
  it("returns the same level as SQL for every sampled total", async () => {
    const mismatches: string[] = [];
    for (const p of samples()) {
      const { data, error } = await admin.rpc("level_for_points", { p });
      if (error) throw error;
      if (data !== levelForPoints(p)) mismatches.push(`${p}: sql=${data} ts=${levelForPoints(p)}`);
    }
    expect(mismatches).toEqual([]);
  });
});
