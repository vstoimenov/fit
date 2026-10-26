import { describe, expect, it } from "vitest";
import {
  detectInstallPlatform,
  installPromptDue,
  INSTALL_PROMPT_SNOOZE_MS,
  type InstallPromptState,
} from "./install-prompt";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

describe("detectInstallPlatform", () => {
  it("tells iPhone/iPad from Android and skips desktops", () => {
    expect(detectInstallPlatform(IPHONE_SAFARI, { standalone: false })).toBe("ios");
    expect(detectInstallPlatform(IPAD_SAFARI, { standalone: false })).toBe("ios");
    expect(detectInstallPlatform(ANDROID_CHROME, { standalone: false })).toBe("android");
    expect(detectInstallPlatform(MAC_CHROME, { standalone: false })).toBe("none");
  });

  it("is none once the app already runs from the home screen", () => {
    expect(detectInstallPlatform(IPHONE_SAFARI, { standalone: true })).toBe("none");
    expect(detectInstallPlatform(ANDROID_CHROME, { standalone: true })).toBe("none");
  });
});

describe("installPromptDue", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  it("shows on the first visit and never again after „done“", () => {
    expect(installPromptDue(null, now)).toBe(true);
    const done: InstallPromptState = { done: true };
    expect(installPromptDue(JSON.stringify(done), now)).toBe(false);
  });

  it("comes back a week after „later“, and ignores garbage", () => {
    const later: InstallPromptState = { snoozedAt: now - INSTALL_PROMPT_SNOOZE_MS + 1 };
    expect(installPromptDue(JSON.stringify(later), now)).toBe(false);
    const expired: InstallPromptState = { snoozedAt: now - INSTALL_PROMPT_SNOOZE_MS - 1 };
    expect(installPromptDue(JSON.stringify(expired), now)).toBe(true);
    expect(installPromptDue("{not json", now)).toBe(true);
  });
});
