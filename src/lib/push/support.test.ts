import { describe, expect, it } from "vitest";
import { pushSupport, urlBase64ToUint8Array } from "./support";

describe("pushSupport", () => {
  it("is ready on a browser with the APIs", () => {
    expect(
      pushSupport({ hasPush: true, isIos: false, standalone: false, permission: "default" }),
    ).toBe("ready");
  });
  it("tells an iPhone to install the app first", () => {
    expect(
      pushSupport({ hasPush: false, isIos: true, standalone: false, permission: "default" }),
    ).toBe("ios_install");
    expect(
      pushSupport({ hasPush: true, isIos: true, standalone: true, permission: "default" }),
    ).toBe("ready");
  });
  it("reports a blocked permission and an unsupported browser", () => {
    expect(
      pushSupport({ hasPush: true, isIos: false, standalone: false, permission: "denied" }),
    ).toBe("denied");
    expect(
      pushSupport({ hasPush: false, isIos: false, standalone: false, permission: "default" }),
    ).toBe("unsupported");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a URL-safe VAPID key", () => {
    const bytes = urlBase64ToUint8Array("AQID_-8");
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255, 239]);
  });
});
