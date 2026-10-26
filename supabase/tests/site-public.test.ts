import { describe, expect, it } from "vitest";
import { adminClient, anonClient } from "./helpers";

describe("public site functions", () => {
  it("anon can read the free workout through the function only", async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc("public_free_workout");
    expect(error).toBeNull();
    expect(data?.[0]?.title).toBe("Първа тренировка: цяло тяло");
    expect(data?.[0]?.duration_min).toBe(20);
    expect(data?.[0]?.video_url).toMatch(/^https:\/\//);

    const direct = await anon.from("workouts").select("id").eq("kind", "free");
    expect(direct.data).toEqual([]);
  });

  it("anon gets only https site links", async () => {
    const admin = adminClient();
    await admin
      .from("settings")
      .upsert({ key: "instagram_url", value: "https://instagram.com/iamstrong" });
    await admin.from("settings").upsert({ key: "trainer_video_url", value: "http://insecure" });

    const { data, error } = await anonClient().rpc("public_site_links");
    expect(error).toBeNull();
    expect(data).toEqual({
      instagram_url: "https://instagram.com/iamstrong",
      trainer_video_url: null,
    });

    // The table itself stays closed to anon (no grant → error, or RLS → empty).
    const direct = await anonClient().from("settings").select("key");
    expect(direct.data ?? []).toEqual([]);
  });

  it("base prices are 29 / 257", async () => {
    const { data } = await adminClient()
      .from("plans")
      .select("name, price_cents")
      .eq("active", true)
      .order("sort");
    expect(data).toEqual([
      { name: "Месечен", price_cents: 2900 },
      { name: "Годишен", price_cents: 25700 },
    ]);
  });
});
