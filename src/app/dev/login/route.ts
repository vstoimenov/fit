import { NextResponse, type NextRequest } from "next/server";
import { clientEnv, serverEnv } from "@/env";
import { safeNext } from "@/lib/auth-redirect";
import { devLoginAccount, devLoginAllowed, shareLoginAllowed } from "@/lib/dev-login";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";
import { createDemoClient } from "@/server/dev/demo-account";

const NOT_FOUND = () => new NextResponse("Not found", { status: 404 });

/**
 * Bookmarkable sign-in without a password, in two modes (404 everywhere else):
 * - local dev on this computer: /dev/login?as=client or ?as=admin signs in as the seeded accounts;
 * - test share (TEST_SHARE_HOST, a temporary public tunnel): ?as=client creates a fresh tester
 *   account with everything unlocked. The admin panel is never reachable this way.
 * A one-time magic link is minted with the service role and redeemed on the spot.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const local = devLoginAllowed({
    nodeEnv: serverEnv.NODE_ENV,
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    host,
  });
  const share = shareLoginAllowed({ shareHost: serverEnv.TEST_SHARE_HOST, host });
  const account = devLoginAccount(request.nextUrl.searchParams.get("as"));
  if (!account || (!local && !(share && account.next === "/app"))) return NOT_FOUND();

  const admin = createAdminSupabaseClient();
  const email = local ? account.email : (await createDemoClient(admin)).email;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    return new NextResponse(
      `Няма тестов профил ${email}. Пусни: node --env-file=.env.local .superpowers/sdd/seed-accounts.mjs`,
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
