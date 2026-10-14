import "server-only";

import { AppError } from "@/lib/app-error";
import { createServerSupabaseClient } from "@/server/db/server";

/** Signed-in user + session client, or AppError("UNAUTHORIZED"). getUser() validates the token. */
export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AppError("UNAUTHORIZED", "Влез в профила си.");
  return { user, supabase };
}
