import { beforeAll, describe, expect, it } from "vitest";
import { markWorkoutComplete } from "@/server/content/completion";
import { getShareCard } from "@/server/content/share";
import {
  adminClient,
  createUser,
  freeWorkoutId,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let freeId: string;
let freeTitle: string;

beforeAll(async () => {
  admin = adminClient();
  freeId = await freeWorkoutId(admin);
  const { data } = await admin.from("workouts").select("title").eq("id", freeId).single();
  freeTitle = data!.title;
});

describe("getShareCard", () => {
  it("returns her own completion as the four public fields only", async () => {
    const a = await createUser(admin, "share-a");
    // Health and questionnaire data that must never reach the card.
    await admin.from("profiles").update({ timezone: "Europe/Sofia" }).eq("id", a.id);
    const dbA = await signedInClient(a);
    const { completionId } = await markWorkoutComplete(dbA, a.id, freeId);

    const card = await getShareCard(dbA, a.id, completionId);
    expect(card).not.toBeNull();
    expect(Object.keys(card!).sort()).toEqual(
      ["streakDays", "weekDone", "weekTarget", "workoutTitle"].sort(),
    );
    expect(card!.workoutTitle).toBe(freeTitle.trim().slice(0, 60));
    expect(card!.streakDays).toBeGreaterThanOrEqual(1);
    expect(card!.weekDone).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(card)).not.toMatch(/Sofia|@example/);
  });

  it("returns null for another member's completion", async () => {
    const a = await createUser(admin, "share-owner");
    const b = await createUser(admin, "share-other");
    const { completionId } = await markWorkoutComplete(await signedInClient(a), a.id, freeId);
    const dbB = await signedInClient(b);
    expect(await getShareCard(dbB, b.id, completionId)).toBeNull();
  });

  it("returns null for an unknown or malformed id", async () => {
    const u = await createUser(admin, "share-404");
    const db = await signedInClient(u);
    expect(await getShareCard(db, u.id, crypto.randomUUID())).toBeNull();
    expect(await getShareCard(db, u.id, "not-a-uuid")).toBeNull();
  });
});
