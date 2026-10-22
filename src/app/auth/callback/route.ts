import { NextResponse, type NextRequest } from "next/server";
import { emailLinkType, safeNext } from "@/lib/auth-redirect";
import { createServerSupabaseClient } from "@/server/db/server";

/**
 * Lands Google sign-in, password-reset and one-time e-mail links: trades the code (or the
 * token hash of an e-mail link) for a session, then redirects inside the site.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = emailLinkType(request.nextUrl.searchParams.get("type"));
  if (!code && tokenHash && type) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
