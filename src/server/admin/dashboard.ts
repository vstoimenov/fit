import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

const n = z.coerce.number();
export const dashboardSchema = z.object({
  visits: z.object({ today: n, d7: n, d30: n, unique_d30: n }),
  sources: z.array(z.object({ source: z.string(), visitors: n })),
  funnel: z.object({ visitors: n, signups: n, free_done: n, paid: n }),
  registrations: z.object({ d7: n, d30: n }),
  subscriptions: z.object({ active: n, mrr_cents: n, canceled_30: n }),
  top_workouts: z.array(z.object({ id: z.string(), title: z.string(), completions: n })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

/**
 * `ownHost` is this site's own host (e.g. "fit.example"): visits referred from it count as direct.
 * Callers pass it in so this module stays free of environment access.
 */
export async function getDashboard(
  db: TypedClient,
  now = new Date(),
  ownHost?: string,
): Promise<Dashboard> {
  const { data, error } = await db.rpc("admin_dashboard", {
    p_now: now.toISOString(),
    p_own_host: ownHost,
  });
  if (error) throw new Error(`load dashboard failed: ${error.message}`);
  return dashboardSchema.parse(data);
}
