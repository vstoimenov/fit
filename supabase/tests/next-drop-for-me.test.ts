import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createUser, createWorkout, signedInClient } from "./helpers";

const admin = adminClient();

describe("next_drop_for_me", () => {
  it("returns the caller's next regular drop without being told her level", async () => {
    const user = await createUser(admin, "drop-me");
    const db = await signedInClient(user);
    const soon = new Date(Date.now() + 30_000).toISOString();
    await createWorkout(admin, {
      title: "Следващата",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: soon,
    });
    const [mine, byLevel] = await Promise.all([
      db.rpc("next_drop_for_me"),
      db.rpc("next_drop_at", { p_level: "beginner" }),
    ]);
    expect(mine.error).toBeNull();
    expect(typeof mine.data).toBe("string");
    expect(Date.parse(mine.data as string)).toBeGreaterThan(Date.now());
    expect(mine.data).toBe(byLevel.data);
  });

  it("is not callable signed out", async () => {
    const { error } = await anonClient().rpc("next_drop_for_me");
    expect(error?.code).toBe("42501");
  });
});
