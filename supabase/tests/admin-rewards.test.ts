import { beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/app-error";
import { adjustPoints, listRewardCandidates, setRewardGiven } from "@/server/admin/rewards";
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
  boss = (await createAdminUser(admin, "rewards-admin")).db;
});

async function member(label: string, points: number) {
  const user = await createUser(admin, label, { name: `Награда ${label}` });
  if (points !== 0) await adjustPoints(boss, user.id, points, "тест");
  return user;
}

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  return error as AppError;
}

describe("listRewardCandidates", () => {
  it("includes a member at 230 points (level 4, not given) and skips lower levels", async () => {
    const reached = await member("rw-l4", 230);
    const below = await member("rw-l3", 219);
    const rows = await listRewardCandidates(boss);
    const row = rows.find((r) => r.userId === reached.id);
    expect(row).toMatchObject({
      name: "Награда rw-l4",
      email: reached.email,
      level: 4,
      points: 230,
      reached: [{ level: 4, given: false, givenAt: null }],
    });
    expect(rows.find((r) => r.userId === below.id)).toBeUndefined();
  });

  it("lists every reached reward level and sorts by level, then points", async () => {
    const top = await member("rw-top", 1700);
    const mid = await member("rw-mid", 1000);
    const rows = await listRewardCandidates(boss);
    const topRow = rows.find((r) => r.userId === top.id);
    expect(topRow?.level).toBe(10);
    expect(topRow?.reached.map((r) => r.level)).toEqual([4, 8, 10]);
    expect(rows.find((r) => r.userId === mid.id)?.reached.map((r) => r.level)).toEqual([4, 8]);
    const ids = rows.map((r) => r.userId);
    expect(ids.indexOf(top.id)).toBeLessThan(ids.indexOf(mid.id));
    const keys = rows.map((r) => [r.level, r.points]);
    expect(keys).toEqual([...keys].sort((a, b) => b[0] - a[0] || b[1] - a[1]));
  });
});

describe("setRewardGiven", () => {
  it("round-trips given and not given", async () => {
    const user = await member("rw-toggle", 230);
    await setRewardGiven(boss, user.id, 4, true, "Код за отстъпка");
    let row = (await listRewardCandidates(boss)).find((r) => r.userId === user.id);
    expect(row?.reached[0]).toMatchObject({ level: 4, given: true });
    expect(row?.reached[0].givenAt).toEqual(expect.any(String));

    // Giving twice keeps the first date.
    const first = row?.reached[0].givenAt;
    await setRewardGiven(boss, user.id, 4, true);
    row = (await listRewardCandidates(boss)).find((r) => r.userId === user.id);
    expect(row?.reached[0].givenAt).toBe(first);

    await setRewardGiven(boss, user.id, 4, false);
    row = (await listRewardCandidates(boss)).find((r) => r.userId === user.id);
    expect(row?.reached[0]).toEqual({ level: 4, given: false, givenAt: null });
    // Taking it back twice is harmless.
    await setRewardGiven(boss, user.id, 4, false);
  });

  it("rejects levels that have no manual reward and overlong notes", async () => {
    const user = await member("rw-bad", 230);
    expect((await rejection(setRewardGiven(boss, user.id, 6 as 4, true))).code).toBe("INVALID");
    expect((await rejection(setRewardGiven(boss, user.id, 4, true, "x".repeat(301)))).code).toBe(
      "INVALID",
    );
  });

  it("is refused for a member, and leaves a given reward in place", async () => {
    const user = await member("rw-self", 230);
    await setRewardGiven(boss, user.id, 4, true);
    const db = await signedInClient(user);
    expect((await rejection(setRewardGiven(db, user.id, 4, true))).code).toBe("FORBIDDEN");
    expect((await rejection(setRewardGiven(db, user.id, 4, false))).code).toBe("FORBIDDEN");
    const row = (await listRewardCandidates(boss)).find((r) => r.userId === user.id);
    expect(row?.reached[0].given).toBe(true);
  });
});

describe("listRewardCandidates for a member", () => {
  it("never shows other members: only her own row, and only when she is at level 4+", async () => {
    const other = await member("rw-other", 300);
    const user = await createUser(admin, "rw-peek");
    const db = await signedInClient(user);
    const rows = await listRewardCandidates(db);
    expect(rows.find((r) => r.userId === other.id)).toBeUndefined();
  });
});

describe("adjustPoints", () => {
  it("adds a signed ledger row visible to the member", async () => {
    const user = await member("rw-adj", 0);
    await adjustPoints(boss, user.id, 60, "  Бонус  ");
    await adjustPoints(boss, user.id, -10, "Корекция");
    const { data } = await boss.rpc("member_points", { uid: user.id });
    expect(data?.[0]).toEqual({ points: 50, level: 2 });
    const { data: rows } = await admin
      .from("points_ledger")
      .select("reason, source")
      .eq("user_id", user.id);
    expect(rows?.map((r) => r.reason).sort()).toEqual(["Бонус", "Корекция"]);
  });

  it("requires a reason and a non-zero amount in range", async () => {
    const user = await member("rw-inv", 0);
    expect((await rejection(adjustPoints(boss, user.id, 10, ""))).code).toBe("INVALID");
    expect((await rejection(adjustPoints(boss, user.id, 10, "   "))).code).toBe("INVALID");
    expect((await rejection(adjustPoints(boss, user.id, 10, "x".repeat(201)))).code).toBe(
      "INVALID",
    );
    expect((await rejection(adjustPoints(boss, user.id, 0, "нула"))).code).toBe("INVALID");
    expect((await rejection(adjustPoints(boss, user.id, 10_001, "много"))).code).toBe("INVALID");
    expect((await rejection(adjustPoints(boss, user.id, 1.5, "дробно"))).code).toBe("INVALID");
  });

  it("is refused for a member and for an unknown member", async () => {
    const user = await member("rw-forb", 0);
    const db = await signedInClient(user);
    expect((await rejection(adjustPoints(db, user.id, 10, "сама си"))).code).toBe("FORBIDDEN");
    const missing = "00000000-0000-4000-8000-000000000000";
    expect((await rejection(adjustPoints(boss, missing, 10, "няма такава"))).code).toBe(
      "NOT_FOUND",
    );
  });
});
