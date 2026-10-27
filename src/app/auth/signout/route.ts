import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-redirect";
import { createServerSupabaseClient } from "@/server/db/server";

/**
 * Drops this device's session cookies and sends her to the login. Used when a page finds the
 * session dead (revoked elsewhere, refresh token gone) while the cookies still exist: without
 * clearing them the optimistic proxy redirect would send her straight back. Local scope only:
 * her other devices stay signed in.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/login");
  return NextResponse.redirect(new URL(next, request.url));
}
