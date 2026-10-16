import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type PublicPlan = {
  id: string;
  name: string;
  interval: "month" | "year";
  price_cents: number;
  currency: string;
};

/**
 * Active plans, read as a signed-out visitor (anon key, no cookies) so the result is the same for
 * everyone and can sit in a shared cache. RLS lets anon see active plans only.
 * Throws on any failure, so a cache never stores an error as if it were an empty price list.
 */
export async function fetchPublicPlans(env: {
  url: string;
  anonKey: string;
}): Promise<PublicPlan[]> {
  const db = createClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("plans")
    .select("id, name, interval, price_cents, currency")
    .eq("active", true)
    .order("sort");
  if (error) throw new Error(`load public plans failed: ${error.message}`);
  return data;
}
