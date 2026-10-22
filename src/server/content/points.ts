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
  return { points: row?.points ?? 0, level: row?.level ?? 1 };
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
