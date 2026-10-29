import "server-only";

import type { TypedClient } from "@/server/db/types";

const PAGE = 1000;

/** Clients who only train in the gym (no online onboarding): kept out of the online club's reports and pushes. */
export async function studioOnlyUserIds(db: TypedClient): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .eq("studio_client", true)
      .eq("onboarding_done", false)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load in-person-only clients failed: ${error.message}`);
    for (const row of data) ids.add(row.id);
    if (data.length < PAGE) return ids;
  }
}
