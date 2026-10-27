export const KEEP_WARM_HEADER = "x-keep-warm";

/**
 * The database's keep-warm job calls the member pages with `x-keep-warm: <CRON_SECRET>` so their
 * functions do not go cold between real visits. The proxy lets such a request through to the page
 * without a session, and `requireUser` answers it with a plain redirect instead of an error.
 * Constant-time comparison; no secret, no header or an empty secret means "not a warm ping".
 */
export function isKeepWarmRequest(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  if (header.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= header.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
