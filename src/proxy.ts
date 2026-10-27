import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/env";
import { decideAuthRedirect } from "@/lib/auth-redirect";
import { devAutoLoginTarget, devLoginAllowed, shareLoginAllowed } from "@/lib/dev-login";

/**
 * Refreshes the Supabase session cookie and applies optimistic auth redirects. Runs only on the
 * routes that need a session (see `config.matcher`): static files, public pages and the webhooks
 * never pay for it.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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

  // getClaims() verifies the JWT locally against the project's signing keys (cached per process)
  // and refreshes an expired session; getUser() would be a network round trip on every request.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ?? null;

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
