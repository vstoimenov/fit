import type { TypedClient } from "@/server/db/types";

/** Newest first. `beforeId` continues from the last entry of the previous page. */
export async function listAudit(db: TypedClient, opts: { beforeId?: number; limit?: number } = {}) {
  let query = db
    .from("audit_log")
    .select("id, actor_id, action, target_type, target_id, diff, created_at")
    .order("id", { ascending: false })
    .limit(Math.min(opts.limit ?? 100, 200));
  if (opts.beforeId) query = query.lt("id", opts.beforeId);
  const { data, error } = await query;
  if (error) throw new Error(`load audit failed: ${error.message}`);
  const actorIds = [...new Set(data.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: people, error: peopleError } = await db
      .from("profiles")
      .select("id, name, email")
      .in("id", actorIds);
    if (peopleError) throw new Error(`load actors failed: ${peopleError.message}`);
    for (const p of people) names.set(p.id, p.name || p.email);
  }
  return data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actorName: r.actor_id ? (names.get(r.actor_id) ?? "изтрит потребител") : "система",
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    diff: r.diff,
  }));
}
