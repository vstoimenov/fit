import { describe, expect, it } from "vitest";
import { createDemoClient } from "@/server/dev/demo-account";
import { adminClient } from "./helpers";

describe("createDemoClient", () => {
  it("creates a fresh tester with everything unlocked", async () => {
    const admin = adminClient();
    const first = await createDemoClient(admin);
    const second = await createDemoClient(admin);
    expect(first.email).not.toBe(second.email);
    expect(first.email).toMatch(/^test-[0-9a-f]{8}@example\.test$/);

    const { data: profile } = await admin
      .from("profiles")
      .select(
        "name, onboarding_done, nutrition_answered_at, diet, birth_year, height_cm, weight_kg",
      )
      .eq("id", first.userId)
      .single();
    expect(profile).toMatchObject({
      name: "Тестова клиентка",
      onboarding_done: true,
      diet: "omnivore",
      birth_year: 1994,
      height_cm: 165,
      weight_kg: 65,
    });
    expect(profile?.nutrition_answered_at).not.toBeNull();

    const { data: sub } = await admin
      .from("subscriptions")
      .select("provider, status, current_period_end")
      .eq("user_id", first.userId)
      .single();
    expect(sub).toMatchObject({ provider: "manual", status: "active" });
    expect(new Date(sub!.current_period_end!).getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 3600 * 1000,
    );

    const { data: ledger } = await admin
      .from("points_ledger")
      .select("points")
      .eq("user_id", first.userId);
    const total = (ledger ?? []).reduce((sum, row) => sum + row.points, 0);
    const { data: level } = await admin.rpc("level_for_points", { p: total });
    expect(level).toBe(10);
  });
});
