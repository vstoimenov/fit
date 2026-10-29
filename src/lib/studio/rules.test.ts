import { describe, expect, it } from "vitest";
import {
  canCancel,
  cardEndsOn,
  cardLine,
  cardWarning,
  isPlaceholderEmail,
  visitsLeftText,
} from "./rules";

describe("cardEndsOn", () => {
  it("counts the start day: 4 weeks from a Tuesday ends on the Monday four weeks later", () => {
    expect(cardEndsOn("2026-11-03", "card8")).toBe("2026-11-30");
  });
  it("gives Карта 12 six weeks", () => {
    expect(cardEndsOn("2026-11-03", "card12")).toBe("2026-12-14");
  });
});

describe("canCancel", () => {
  const start = "2026-11-05T17:00:00.000Z";
  it("allows cancelling exactly 6 hours before", () => {
    expect(canCancel(start, new Date("2026-11-05T11:00:00.000Z"))).toBe(true);
  });
  it("refuses inside the last 6 hours", () => {
    expect(canCancel(start, new Date("2026-11-05T11:01:00.000Z"))).toBe(false);
  });
});

describe("visitsLeftText", () => {
  it("uses the singular for one visit", () => {
    expect(visitsLeftText(1)).toBe("остава 1 посещение");
  });
  it("uses the plural for several", () => {
    expect(visitsLeftText(5)).toBe("остават 5 посещения");
  });
  it("says none are left at zero", () => {
    expect(visitsLeftText(0)).toBe("няма оставащи посещения");
  });
});

describe("cardLine", () => {
  it("reads like the price list", () => {
    expect(cardLine({ kind: "card8", remaining: 5, endsOn: "2026-11-26" })).toBe(
      "Карта 8 · остават 5 посещения · валидна до 26.11",
    );
  });
});

describe("cardWarning", () => {
  it("warns when one visit is left", () => {
    expect(cardWarning({ remaining: 1, endsOn: "2026-12-30" }, "2026-11-01")).toBe("low");
  });
  it("warns 3 days before the end", () => {
    expect(cardWarning({ remaining: 4, endsOn: "2026-11-04" }, "2026-11-01")).toBe("expiring");
  });
  it("stays quiet 4 days before the end", () => {
    expect(cardWarning({ remaining: 4, endsOn: "2026-11-05" }, "2026-11-01")).toBeNull();
  });
  it("stays quiet on a used-up card", () => {
    expect(cardWarning({ remaining: 0, endsOn: "2026-11-02" }, "2026-11-01")).toBeNull();
  });
  it("stays quiet on an ended card", () => {
    expect(cardWarning({ remaining: 1, endsOn: "2026-10-31" }, "2026-11-01")).toBeNull();
  });
});

describe("isPlaceholderEmail", () => {
  it("recognises a walk-in placeholder", () => {
    expect(isPlaceholderEmail("walkin-1@na-myasto.invalid")).toBe(true);
  });
  it("leaves real e-mails alone", () => {
    expect(isPlaceholderEmail("a@b.bg")).toBe(false);
  });
});
