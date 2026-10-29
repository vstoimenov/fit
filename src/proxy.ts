import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/env";
import { decideAuthRedirect } from "@/lib/auth-redirect";
import { devAutoLoginTarget, devLoginAllowed, shareLoginAllowed } from "@/lib/dev-login";
import { KEEP_WARM_HEADER, isKeepWarmRequest } from "@/lib/keep-warm";

/**
 * Refreshes the Supabase session cookie and applies optimistic auth redirects. Runs only on the
 * routes that need a session (see `config.matcher`): static files, public pages and the webhooks
 * never pay for it.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // The keep-warm job (see src/lib/keep-warm.ts) must reach the page function itself; the page
  // answers it with a redirect. No session lookup, no redirect here.
  if (isKeepWarmRequest(request.headers.get(KEEP_WARM_HEADER), process.env.CRON_SECRET)) {
    return response;
  }

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
          // Cache-control headers keep a CDN from caching a response that carries a session cookie.
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // getUser() asks Supabase Auth, so a revoked session (signed out elsewhere, refresh token reused)
  // is caught here and never reaches a page. A local JWT check (getClaims) trusted such a token
  // until it expired and sent the member round in a /app ↔ /login loop. The function runs next to
  // the database, so this round trip is cheap; the matcher keeps it off static files and public pages.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Testing only: a signed-out visit signs in as a test account instead of showing /login —
  // locally (client or admin) or on the test-share tunnel host (member app only, a fresh tester).
  const host = request.headers.get("host");
  const devLocal = devLoginAllowed({
    nodeEnv: process.env.NODE_ENV,
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    host,
  });
  const devShare =
    shareLoginAllowed({ shareHost: process.env.TEST_SHARE_HOST, host }) &&
    /^\/app(\/|$)/.test(request.nextUrl.pathname);
  const devTarget =
    !user && (devLocal || devShare)
      ? devAutoLoginTarget(request.nextUrl.pathname, request.nextUrl.search)
      : null;
  const target =
    devTarget ??
    decideAuthRedirect({
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      hasSession: user !== null,
    });
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  // Only where a session matters: the member and admin areas, the auth pages, the marketing pages
  // that send a signed-in member to the app, and the API routes that act for the signed-in user.
  // The admin manifest is fetched without cookies by the browser, so it stays public.
  matcher: [
    "/",
    "/landing",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/start/:path*",
    "/zala",
    "/zala/:path*",
    "/app/:path*",
    "/auth/:path*",
    "/dev/:path*",
    "/admin",
    "/admin/:path((?!manifest\\.webmanifest$).*)",
    "/api/me/:path*",
    "/api/share/:path*",
    "/api/live/:path*",
  ],
};
