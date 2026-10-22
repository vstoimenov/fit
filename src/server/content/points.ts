import type { TypedClient } from "@/server/db/types";

export interface MemberPoints {
  points: number;
  level: number;
}

export interface PointsLedgerEntry {
  id: string;
  source: string;
  ref: string;
  points: number;
  reason: string | null;
  createdAt: string;
}

/** Total points and level for a member (herself, or any member for an admin). */
export async function getMemberPoints(db: TypedClient, userId: string): Promise<MemberPoints> {
  const { data, error } = await db.rpc("member_points", { uid: userId });
  if (error) throw new Error(`load member points failed: ${error.message}`);
  const row = data[0];
  // member_points always yields a row (zero for a member without entries); none means a broken read.
  if (!row) throw new Error("load points failed: no row");
  return { points: row.points, level: row.level };
}

/**
 * For pages where points are a nicety (lock pills, the explanation on a locked workout): a failed
 * read is logged and treated as unknown instead of breaking the page.
 */
export async function getMemberPointsOrNull(
  db: TypedClient,
  userId: string,
): Promise<MemberPoints | null> {
  try {
    return await getMemberPoints(db, userId);
  } catch (error) {
    console.error("member points unavailable", error instanceof Error ? error.message : error);
    return null;
  }
}

/** A member's ledger, newest first. */
export async function listPointsLedger(
  db: TypedClient,
  userId: string,
  limit = 20,
): Promise<PointsLedgerEntry[]> {
  const { data, error } = await db
    .from("points_ledger")
    .select("id, source, ref, points, reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`load points ledger failed: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    source: r.source,
    ref: r.ref,
    points: r.points,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}
