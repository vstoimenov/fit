import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { clientEnv } from "@/env";
import { foundersLive } from "@/lib/site/founders";
import type { Database } from "@/lib/supabase/database.types";
import { fetchPublicPlans, type PublicPlan } from "@/server/content/public-plans";
import { mapFreeWorkout, mapSiteLinks, type FreeWorkout, type SiteLinks } from "./map";

/**
 * Reads for the public site. Everything goes through the anon key with no cookies, so the
 * result is identical for every visitor and can live in the shared cache for an hour.
 *
 * The marketing pages must render even while the database is unreachable (a paused project, a
 * network blip while Vercel prerenders). An error thrown inside a `"use cache"` scope fails the
 * prerender even if the caller catches it, so each reader catches its own failure, returns a
 * fallback and shortens the cache life to minutes, so the next revalidation retries soon.
 */
function anonDb() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function unavailable(label: string, error: unknown) {
  // The shortest cacheLife call wins, so a failure is cached only briefly.
  cacheLife("minutes");
  console.error(`site: ${label} unavailable:`, error instanceof Error ? error.message : error);
}

export async function getFreeWorkout(): Promise<FreeWorkout | null> {
  "use cache";
  cacheLife("hours");
  try {
    const { data, error } = await anonDb().rpc("public_free_workout");
    if (error) throw new Error(error.message);
    return mapFreeWorkout(data?.[0] ?? null);
  } catch (error) {
    unavailable("free workout", error);
    return null;
  }
}

export async function getSiteLinks(): Promise<SiteLinks> {
  "use cache";
  cacheLife("hours");
  try {
    const { data, error } = await anonDb().rpc("public_site_links");
    if (error) throw new Error(error.message);
    return mapSiteLinks(data);
  } catch (error) {
    unavailable("site links", error);
    return { trainerVideo: null, instagramUrl: null };
  }
}

/**
 * Time-dependent bits of the public pages. `new Date()` is not allowed while prerendering, but it
 * is fine inside a cached function; an hour of staleness is irrelevant for a day-level flag and
 * the copyright year.
 */
export async function getSiteFlags(): Promise<{ showFounders: boolean; year: number }> {
  "use cache";
  cacheLife("hours");
  const now = new Date();
  return { showFounders: foundersLive(now), year: now.getFullYear() };
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  "use cache";
  cacheLife("hours");
  try {
    return await fetchPublicPlans({
      url: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  } catch (error) {
    unavailable("plans", error);
    return [];
  }
}
