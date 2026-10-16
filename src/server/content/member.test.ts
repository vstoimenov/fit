import { describe, expect, it } from "vitest";
import type { TypedClient } from "@/server/db/types";
import { getMemberLevel } from "./member";

const dbReturning = (result: { data: unknown; error: { message: string } | null }) =>
  ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }),
  }) as unknown as TypedClient;

describe("getMemberLevel", () => {
  it.each(["beginner", "advanced", "pro"])("returns the stored level %s", async (level) => {
    expect(await getMemberLevel(dbReturning({ data: { level }, error: null }), "u")).toBe(level);
  });

  it("falls back to beginner when the profile is missing", async () => {
    expect(await getMemberLevel(dbReturning({ data: null, error: null }), "u")).toBe("beginner");
  });

  it("falls back to beginner for an unexpected level", async () => {
    expect(await getMemberLevel(dbReturning({ data: { level: "guru" }, error: null }), "u")).toBe(
      "beginner",
    );
  });

  it("throws when the read fails", async () => {
    await expect(
      getMemberLevel(dbReturning({ data: null, error: { message: "boom" } }), "u"),
    ).rejects.toThrow("load profile failed: boom");
  });
});
