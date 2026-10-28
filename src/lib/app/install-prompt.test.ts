import { describe, expect, it } from "vitest";
import {
  detectInstallPlatform,
  installPromptDue,
  isInAppBrowser,
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

  it("treats iPadOS Safari (desktop user agent with touch) as iOS", () => {
    const IPADOS =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
    expect(detectInstallPlatform(IPADOS, { standalone: false, touchPoints: 5 })).toBe("ios");
    expect(detectInstallPlatform(IPADOS, { standalone: false, touchPoints: 0 })).toBe("none");
  });

  it("sends Instagram and Facebook in-app browsers to Safari or Chrome", () => {
    const IG = `${IPHONE_SAFARI} Instagram 312.0.0`;
    const FB = `${ANDROID_CHROME} [FBAN/FB4A;FBAV/450.0]`;
    expect(detectInstallPlatform(IG, { standalone: false })).toBe("in_app");
    expect(detectInstallPlatform(FB, { standalone: false })).toBe("in_app");
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

describe("isInAppBrowser", () => {
  it("spots the Instagram, Facebook and Messenger browsers, where Google refuses to sign in", () => {
    expect(
      isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 350.0"),
    ).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/480.0]")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) [FBAN/MessengerForiOS]")).toBe(true);
  });

  it("leaves Safari and Chrome alone", () => {
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1",
      ),
    ).toBe(false);
    expect(
      isInAppBrowser("Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36"),
    ).toBe(false);
  });
});
