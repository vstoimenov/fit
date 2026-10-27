import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AppError } from "@/lib/app-error";
import { KEEP_WARM_HEADER, isKeepWarmRequest } from "@/lib/keep-warm";
import { createServerSupabaseClient } from "@/server/db/server";

/** Signed-in user + session client, or AppError("UNAUTHORIZED"). getUser() validates the token. Once per request. */
export const requireUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    // A keep-warm ping has done its job once the function is running: send it away quietly, so it
    // never shows up as an error (pages render next to their layout and would both log one).
    const warm = isKeepWarmRequest(
      (await headers()).get(KEEP_WARM_HEADER),
      process.env.CRON_SECRET,
    );
    if (warm) redirect("/login");
    throw new AppError("UNAUTHORIZED", "Влез в профила си.");
  }
  return { user, supabase };
});
