import { beforeAll, describe, expect, it } from "vitest";
import { markWorkoutComplete } from "@/server/content/completion";
import { shareText, toShareCard } from "@/lib/share/share-card";
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
    // Health and questionnaire data that must never reach the card or its text.
    const seeded = await admin
      .from("profiles")
      .update({
        timezone: "Europe/Sofia",
        height_cm: 171,
        weight_kg: 71.3,
        target_weight_kg: 64.7,
        goal: "lose_weight",
        problems: ["belly", "legs"],
      })
      .eq("id", a.id);
    const seededCheckIn = await admin
      .from("check_ins")
      .insert({ user_id: a.id, weight_kg: 70.8, waist_cm: 77.3, note: "лична бележка 0451" });
    expect(seeded.error).toBeNull();
    expect(seededCheckIn.error).toBeNull();
    const dbA = await signedInClient(a);
    const { completionId } = await markWorkoutComplete(dbA, a.id, freeId);

    const card = await getShareCard(dbA, a.id, completionId);
    expect(card).not.toBeNull();
    expect(Object.keys(card!).sort()).toEqual(
      ["streakDays", "weekDone", "weekTarget", "workoutTitle"].sort(),
    );
    expect(card!.workoutTitle).toBe(toShareCard({ workoutTitle: freeTitle }).workoutTitle);
    expect(card!.streakDays).toBeGreaterThanOrEqual(1);
    expect(card!.weekDone).toBeGreaterThanOrEqual(1);
    const leaked = /Sofia|@example|71\.3|64\.7|70\.8|77\.3|171|lose_weight|belly|legs|бележка|0451/;
    expect(JSON.stringify(card)).not.toMatch(leaked);
    expect(shareText(card!)).not.toMatch(leaked);
  });

  it("returns null for another member's completion", async () => {
    const a = await createUser(admin, "share-owner");
    const b = await createUser(admin, "share-other");
    const { completionId } = await markWorkoutComplete(await signedInClient(a), a.id, freeId);
    const dbB = await signedInClient(b);
    expect(await getShareCard(dbB, b.id, completionId)).toBeNull();
  });

  it("returns null when another member passes the owner's id: RLS blocks, not only the filter", async () => {
    const a = await createUser(admin, "share-rls-owner");
    const b = await createUser(admin, "share-rls-other");
    const { completionId } = await markWorkoutComplete(await signedInClient(a), a.id, freeId);
    const dbB = await signedInClient(b);
    expect(await getShareCard(dbB, a.id, completionId)).toBeNull();
  });

  it("returns null for an unknown or malformed id", async () => {
    const u = await createUser(admin, "share-404");
    const db = await signedInClient(u);
    expect(await getShareCard(db, u.id, crypto.randomUUID())).toBeNull();
    expect(await getShareCard(db, u.id, "not-a-uuid")).toBeNull();
  });
});
