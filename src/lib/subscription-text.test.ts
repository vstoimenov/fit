import { describe, expect, it } from "vitest";
import { endNotice, subscriptionText } from "./subscription-text";

describe("subscriptionText", () => {
  it("says there is no subscription when access is off and no row exists", () => {
    expect(subscriptionText(false, null)).toBe("Нямаш активен абонамент");
  });

  it("describes the status the access rule granted access for", () => {
    expect(subscriptionText(true, { status: "active", current_period_end: null })).toBe("Активен");
    expect(subscriptionText(true, { status: "trialing", current_period_end: null })).toBe(
      "Пробен период",
    );
    expect(subscriptionText(true, { status: "past_due", current_period_end: null })).toContain(
      "плащане",
    );
  });

  it("shows until when a canceled subscription still gives access", () => {
    const text = subscriptionText(true, {
      status: "canceled",
      current_period_end: "2026-12-20T10:00:00Z",
    });
    expect(text).toContain("Отказан");
    expect(text).toContain("2026");
  });

  it("trusts access over the row: an admin without a subscription has access", () => {
    expect(subscriptionText(true, null)).toBe("Достъп до всички тренировки");
  });

  it("explains an ended subscription", () => {
    expect(subscriptionText(false, { status: "canceled", current_period_end: null })).toBe(
      "Абонаментът ти е приключил",
    );
    expect(subscriptionText(false, { status: "none", current_period_end: null })).toBe(
      "Нямаш активен абонамент",
    );
  });
});

describe("endNotice", () => {
  const now = new Date("2026-12-01T10:00:00Z");
  const sub = (over: Partial<Parameters<typeof endNotice>[0] & object> = {}) => ({
    status: "active" as const,
    cancel_at_period_end: true,
    current_period_end: "2026-12-20T10:00:00Z",
    ...over,
  });

  it("announces the end date of a live subscription that will not renew", () => {
    for (const status of ["active", "trialing", "past_due"] as const) {
      expect(endNotice(sub({ status }), now)).toBe("Абонаментът ще приключи на 20.12.2026");
    }
  });

  it("uses the Sofia calendar day", () => {
    expect(endNotice(sub({ current_period_end: "2026-12-20T23:30:00Z" }), now)).toBe(
      "Абонаментът ще приключи на 21.12.2026",
    );
  });

  it("says nothing once the period has ended", () => {
    expect(endNotice(sub({ current_period_end: "2026-11-20T10:00:00Z" }), now)).toBeNull();
  });

  it("says nothing for a canceled subscription: subscriptionText already shows the date", () => {
    expect(endNotice(sub({ status: "canceled" }), now)).toBeNull();
    expect(
      endNotice(sub({ status: "canceled", current_period_end: "2026-11-20T10:00:00Z" }), now),
    ).toBeNull();
  });

  it("says nothing for a renewing subscription, a missing date or no row", () => {
    expect(endNotice(sub({ cancel_at_period_end: false }), now)).toBeNull();
    expect(endNotice(sub({ current_period_end: null }), now)).toBeNull();
    expect(endNotice(null, now)).toBeNull();
  });
});
