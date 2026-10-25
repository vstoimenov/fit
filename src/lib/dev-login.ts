const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

/**
 * The bookmarkable test sign-in (/dev/login) exists only for a dev server opened on this computer
 * against the local Supabase stack. Any other build, database or host refuses it.
 */
export function devLoginAllowed(input: {
  nodeEnv: string | undefined;
  supabaseUrl: string;
  host: string | null;
}): boolean {
  if (input.nodeEnv !== "development") return false;
  const db = hostnameOf(input.supabaseUrl);
  if (!db || !LOCAL_HOSTS.has(db)) return false;
  const site = input.host ? hostnameOf(`http://${input.host}`) : null;
  return site !== null && LOCAL_HOSTS.has(site);
}

/**
 * Test-share mode (a temporary public tunnel to this computer): the tester sign-in works only on
 * the exact host named in TEST_SHARE_HOST. Unset means off.
 */
export function shareLoginAllowed(input: {
  shareHost: string | undefined;
  host: string | null;
}): boolean {
  return Boolean(input.shareHost) && input.host === input.shareHost;
}

/**
 * Where the proxy sends a signed-out visit when the dev sign-in is allowed: the admin panel signs in
 * as the test admin, the member app as the test client, and the page she asked for is kept.
 */
export function devAutoLoginTarget(pathname: string, search: string): string | null {
  const as = /^\/admin(\/|$)/.test(pathname)
    ? "admin"
    : /^\/app(\/|$)/.test(pathname)
      ? "client"
      : null;
  if (!as) return null;
  return `/dev/login?as=${as}&next=${encodeURIComponent(pathname + search)}`;
}

const ACCOUNTS = {
  client: { email: "klientka@example.test", next: "/app" },
  admin: { email: "admin@example.test", next: "/admin" },
} as const;

/** The local test account and start page for `?as=client|admin`, or null for anything else. */
export function devLoginAccount(as: string | null): { email: string; next: string } | null {
  return as === "client" || as === "admin" ? { ...ACCOUNTS[as] } : null;
}
