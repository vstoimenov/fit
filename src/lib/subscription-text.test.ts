import { describe, expect, it } from "vitest";
import { subscriptionText } from "./subscription-text";

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
