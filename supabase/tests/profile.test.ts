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
    const data = await exportMyData(db, user.id);
    expect(data.profile).toMatchObject({ id: user.id });
    expect(data.check_ins).toHaveLength(1);
    expect(data.workout_completions).toHaveLength(1);
  });

  it("deletes the account and every row that belongs to it", async () => {
    const user = await createUser(admin, "delete");
    await addCheckIn(await signedInClient(user), { energy: 3 });
    await deleteAccount(admin, user.id);
    const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id);
    const { data: checkIns } = await admin.from("check_ins").select("id").eq("user_id", user.id);
    expect(profile).toEqual([]);
    expect(checkIns).toEqual([]);
  });
});
