import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { clientEnv } from "@/env";
import type { Database } from "@/lib/supabase/database.types";
import { fetchPublicPlans, type PublicPlan } from "@/server/content/public-plans";
import { mapFreeWorkout, mapSiteLinks, type FreeWorkout, type SiteLinks } from "./map";

/**
 * Reads for the public site. Everything goes through the anon key with no cookies, so the
 * result is identical for every visitor and can live in the shared cache for an hour.
 */
function anonDb() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function getFreeWorkout(): Promise<FreeWorkout | null> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await anonDb().rpc("public_free_workout");
  if (error) throw new Error(`load free workout failed: ${error.message}`);
  return mapFreeWorkout(data?.[0] ?? null);
}

export async function getSiteLinks(): Promise<SiteLinks> {
  "use cache";
  cacheLife("hours");
  const { data, error } = await anonDb().rpc("public_site_links");
  if (error) throw new Error(`load site links failed: ${error.message}`);
  return mapSiteLinks(data);
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  "use cache";
  cacheLife("hours");
  return fetchPublicPlans({
    url: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
