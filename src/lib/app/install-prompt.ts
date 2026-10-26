export type InstallPlatform = "ios" | "android" | "none";

/** What the „add to home screen" note remembers per browser. */
export type InstallPromptState = { done?: boolean; snoozedAt?: number };

export const INSTALL_PROMPT_KEY = "iamstrong.install-prompt";
/** „По-късно" hides the note for a week. */
export const INSTALL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** iPhone/iPad (Safari share sheet) or Android (Chrome menu); none on desktop or once installed. */
export function detectInstallPlatform(
  userAgent: string,
  opts: { standalone: boolean },
): InstallPlatform {
  if (opts.standalone) return "none";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
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
