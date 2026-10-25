import { NextResponse, type NextRequest } from "next/server";
import { clientEnv, serverEnv } from "@/env";
import { safeNext } from "@/lib/auth-redirect";
import { devLoginAccount, devLoginAllowed } from "@/lib/dev-login";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";

/**
 * Local-only, bookmarkable sign-in as a test account: /dev/login?as=client or ?as=admin.
 * Mints a one-time magic link with the service role and redeems it on the spot. 404 everywhere
 * except a dev server on this computer with the local Supabase stack.
 */
export async function GET(request: NextRequest) {
  const allowed = devLoginAllowed({
    nodeEnv: serverEnv.NODE_ENV,
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    host: request.headers.get("host"),
  });
  const account = devLoginAccount(request.nextUrl.searchParams.get("as"));
  if (!allowed || !account) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await createAdminSupabaseClient().auth.admin.generateLink({
    type: "magiclink",
    email: account.email,
  });
  if (error || !data.properties?.hashed_token) {
    return new NextResponse(
      `Няма тестов профил ${account.email}. Пусни: node --env-file=.env.local .superpowers/sdd/seed-accounts.mjs`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) return NextResponse.redirect(new URL("/login?error=link", request.url));
  const next = safeNext(request.nextUrl.searchParams.get("next"), account.next);
  return NextResponse.redirect(new URL(next, request.url));
}
