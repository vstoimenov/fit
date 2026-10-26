const PROTECTED = [/^\/app(\/|$)/, /^\/admin(\/|$)/];
/** Marketing pages a signed-in member never sees: she goes straight to the app. */
const MARKETING = new Set(["/", "/landing", "/login"]);

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
  if (MARKETING.has(input.pathname) && input.hasSession) return "/app";
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

const EMAIL_LINK_TYPES = ["magiclink", "recovery", "invite", "email"] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

/** The one-time e-mail link types the callback may verify (`token_hash` links); anything else is refused. */
export function emailLinkType(type: string | null): EmailLinkType | null {
  return (EMAIL_LINK_TYPES as readonly string[]).includes(type ?? "")
    ? (type as EmailLinkType)
    : null;
}
