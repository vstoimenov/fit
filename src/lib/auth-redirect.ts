const PROTECTED = [/^\/app(\/|$)/, /^\/admin(\/|$)/];

/** Optimistic redirect decided in the proxy; real checks live in requireUser() and RLS. */
export function decideAuthRedirect(input: {
  pathname: string;
  search: string;
  hasSession: boolean;
}): string | null {
  const isProtected = PROTECTED.some((re) => re.test(input.pathname));
  if (isProtected && !input.hasSession) {
    return `/login?next=${encodeURIComponent(input.pathname + input.search)}`;
  }
  if (input.pathname === "/login" && input.hasSession) return "/app";
  return null;
}

/** A post-login destination that can only point inside this site. */
export function safeNext(next: string | null, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}
