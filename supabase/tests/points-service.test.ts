import { beforeAll, describe, expect, it } from "vitest";
import { getMemberPoints, listPointsLedger } from "@/server/content/points";
import {
  adminClient,
  createAdminUser,
  createUser,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "points-svc-admin")).db;
});

describe("points service", () => {
  it("returns zero points and level 1 for a new member", async () => {
    const user = await createUser(admin, "svc-new");
    const db = await signedInClient(user);
    expect(await getMemberPoints(db, user.id)).toEqual({ points: 0, level: 1 });
    expect(await listPointsLedger(db, user.id)).toEqual([]);
  });

  it("reflects admin adjustments, newest first, with a limit", async () => {
    const user = await createUser(admin, "svc-adjust");
    const first = await boss.rpc("admin_adjust_points", {
      p_user_id: user.id,
      p_points: 60,
      p_reason: "first",
    });
    expect(first.error).toBeNull();
    const second = await boss.rpc("admin_adjust_points", {
      p_user_id: user.id,
      p_points: 5,
      p_reason: "second",
    });
    expect(second.error).toBeNull();

    const db = await signedInClient(user);
    expect(await getMemberPoints(db, user.id)).toEqual({ points: 65, level: 2 });
    const all = await listPointsLedger(db, user.id);
    expect(all.map((e) => e.reason)).toEqual(["second", "first"]);
    expect(all[0]).toMatchObject({ source: "admin", points: 5 });
    expect(await listPointsLedger(db, user.id, 1)).toHaveLength(1);
  });

  it("throws when a member asks for someone else", async () => {
    const a = await createUser(admin, "svc-a");
    const b = await createUser(admin, "svc-b");
    const db = await signedInClient(a);
    await expect(getMemberPoints(db, b.id)).rejects.toThrow(/load member points failed/);
  });
});
