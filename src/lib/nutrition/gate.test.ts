import { describe, expect, it } from "vitest";
import { nutritionGate } from "./gate";

const phone = { isAdmin: false, mobile: true, inApp: false, pushKey: true } as const;

describe("nutritionGate", () => {
  it("opens on a phone once the app is on the home screen and notifications are on", () => {
    expect(
      nutritionGate({ ...phone, standalone: true, pushOn: true, pushSupport: "ready" }),
    ).toEqual({ open: true, install: "done", push: "done" });
  });

  it("asks a phone in the browser to install first, then to turn notifications on", () => {
    expect(
      nutritionGate({ ...phone, standalone: false, pushOn: false, pushSupport: "ios_install" }),
    ).toEqual({ open: false, install: "todo", push: "todo" });
    expect(
      nutritionGate({ ...phone, standalone: true, pushOn: false, pushSupport: "ready" }),
    ).toEqual({ open: false, install: "done", push: "todo" });
  });

  it("does not ask a computer to install, only for notifications", () => {
    const desk = { ...phone, mobile: false, standalone: false };
    expect(nutritionGate({ ...desk, pushOn: false, pushSupport: "ready" })).toMatchObject({
      open: false,
      install: "n/a",
    });
    expect(nutritionGate({ ...desk, pushOn: true, pushSupport: "ready" }).open).toBe(true);
  });

  it("says when notifications are blocked or the browser is an in-app one", () => {
    expect(
      nutritionGate({ ...phone, standalone: true, pushOn: false, pushSupport: "denied" }).push,
    ).toBe("blocked");
    expect(
      nutritionGate({
        ...phone,
        inApp: true,
        standalone: false,
        pushOn: false,
        pushSupport: "unsupported",
      }),
    ).toEqual({ open: false, install: "in_app", push: "todo" });
  });

  it("never blocks the owner, nor anyone while the site has no push keys", () => {
    expect(
      nutritionGate({
        ...phone,
        isAdmin: true,
        standalone: false,
        pushOn: false,
        pushSupport: "ready",
      }).open,
    ).toBe(true);
    expect(
      nutritionGate({
        ...phone,
        pushKey: false,
        standalone: true,
        pushOn: false,
        pushSupport: "ready",
      }),
    ).toEqual({ open: true, install: "done", push: "n/a" });
  });
});
