import { describe, expect, it } from "vitest";
import { deviceFromUserAgent } from "./device";

describe("deviceFromUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      "mobile",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36",
      "mobile",
    ],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15", "tablet"],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      "tablet",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15",
      "desktop",
    ],
    [null, "desktop"],
  ])("%s → %s", (ua, expected) => {
    expect(deviceFromUserAgent(ua)).toBe(expected);
  });
});
