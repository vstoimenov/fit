import "server-only";

import { parseSetting } from "@/lib/admin/settings";
import type { TypedClient } from "@/server/db/types";

/** The gym address for the map on /zala (settings are admin-only: pass the service-role client). */
export async function getStudioAddress(service: TypedClient): Promise<string> {
  const { data, error } = await service
    .from("settings")
    .select("value")
    .eq("key", "studio_address")
    .maybeSingle();
  if (error) throw new Error(`load studio address failed: ${error.message}`);
  return parseSetting("studio_address", data?.value);
}
