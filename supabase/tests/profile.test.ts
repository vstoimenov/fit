import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addCheckIn,
  deleteAccount,
  exportMyData,
  updateProfileBasics,
} from "@/server/profile/profile";
import {
  adminClient,
  createUser,
  freeWorkoutId,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("profile services", () => {
  it("updates name and level", async () => {
    const user = await createUser(admin, "basics");
    await updateProfileBasics(await signedInClient(user), user.id, { name: "Ива", level: "pro" });
    const { data } = await admin.from("profiles").select("name, level").eq("id", user.id).single();
    expect(data).toEqual({ name: "Ива", level: "pro" });
  });

  it("exports the user's own data", async () => {
    const user = await createUser(admin, "export");
    const db = await signedInClient(user);
    await addCheckIn(db, { weight_kg: 63 });
    await db.from("workout_completions").insert({ workout_id: await freeWorkoutId(admin) });
    const anonId = randomUUID();
    const { error: seedError } = await admin.from("visits").insert([
      { anon_id: anonId, user_id: user.id, path: "/app", device: "mobile" },
      { anon_id: randomUUID(), path: "/other", device: "desktop" },
    ]);
    expect(seedError).toBeNull();
    const data = await exportMyData(db, user.id, admin);
    expect(data.profile).toMatchObject({ id: user.id });
    expect(data.check_ins).toHaveLength(1);
    expect(data.workout_completions).toHaveLength(1);
    expect(data.visits).toEqual([
      expect.objectContaining({ path: "/app", device: "mobile", referrer: null, utm: null }),
    ]);
  });

  it("deletes the account and every row that belongs to it", async () => {
    const user = await createUser(admin, "delete");
    await addCheckIn(await signedInClient(user), { energy: 3 });
    const anonId = randomUUID();
    const strangerAnonId = randomUUID();
    const { error: seedError } = await admin.from("visits").insert([
      { anon_id: anonId, user_id: user.id, path: "/app", device: "mobile" },
      { anon_id: anonId, path: "/before-login", device: "mobile" },
      { anon_id: strangerAnonId, path: "/unrelated", device: "desktop" },
    ]);
    expect(seedError).toBeNull();
    await deleteAccount(admin, user.id);
    const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id);
    const { data: checkIns } = await admin.from("check_ins").select("id").eq("user_id", user.id);
    expect(profile).toEqual([]);
    expect(checkIns).toEqual([]);
    const { data: visits } = await admin
      .from("visits")
      .select("anon_id")
      .in("anon_id", [anonId, strangerAnonId]);
    expect(visits).toEqual([{ anon_id: strangerAnonId }]);
  });
});
