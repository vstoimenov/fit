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

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const LOCAL_ORIGIN = "http://local.invalid";

/** A post-login destination that can only point inside this site. */
export function safeNext(next: string | null, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || CONTROL_CHARS.test(next)) return fallback;
  try {
    const url = new URL(next, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return fallback;
    const path = url.pathname + url.search + url.hash;
    // Dot segments can normalize into a protocol-relative URL ("//evil.com"), so check the result too.
    if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
