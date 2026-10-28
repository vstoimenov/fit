export type InstallPlatform = "ios" | "android" | "in_app" | "none";

/** What the „add to home screen" note remembers per browser. */
export type InstallPromptState = { done?: boolean; snoozedAt?: number };

/** Instagram, Facebook and Messenger open links in their own browser, which cannot install apps or sign in with Google. */
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Messenger/i;

/** True inside the Instagram/Facebook/Messenger browser (Google refuses OAuth there: disallowed_useragent). */
export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP.test(userAgent);
}

export const INSTALL_PROMPT_KEY = "iamstrong.install-prompt";
/** „По-късно" hides the note for a week. */
export const INSTALL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * iPhone/iPad (Safari share sheet), Android (Chrome menu), or an in-app browser (Instagram, Facebook)
 * that cannot install at all and must hand over to Safari or Chrome; none on desktop or once
 * installed. iPadOS Safari reports a Mac user agent, so touch points tell it apart.
 */
export function detectInstallPlatform(
  userAgent: string,
  opts: { standalone: boolean; touchPoints?: number },
): InstallPlatform {
  if (opts.standalone) return "none";
  const ios =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/.test(userAgent) && (opts.touchPoints ?? 0) > 1);
  const android = /Android/i.test(userAgent);
  if ((ios || android) && isInAppBrowser(userAgent)) return "in_app";
  if (ios) return "ios";
  if (android) return "android";
  return "none";
}

/** Whether the note should show, given what localStorage holds (null = never shown). */
export function installPromptDue(stored: string | null, now: number): boolean {
  if (!stored) return true;
  let state: InstallPromptState;
  try {
    state = JSON.parse(stored) as InstallPromptState;
  } catch {
    return true;
  }
  if (state.done) return false;
  if (typeof state.snoozedAt === "number") return now - state.snoozedAt > INSTALL_PROMPT_SNOOZE_MS;
  return true;
}
