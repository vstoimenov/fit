import type { Level } from "@/lib/program/types";
import type { TypedClient } from "@/server/db/types";

const LEVELS: readonly Level[] = ["beginner", "advanced", "pro"];
export const DEFAULT_LEVEL: Level = "beginner";

/** The member's own level; beginner when the profile is missing or holds an unexpected value. */
export async function getMemberLevel(db: TypedClient, userId: string): Promise<Level> {
  const { data, error } = await db.from("profiles").select("level").eq("id", userId).maybeSingle();
  if (error) throw new Error(`load profile failed: ${error.message}`);
  return LEVELS.find((l) => l === data?.level) ?? DEFAULT_LEVEL;
}
