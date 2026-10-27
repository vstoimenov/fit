import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MenuView, SAMPLE_MENU_NOTE } from "./menu-view";

// The dish card pulls in server actions and env; these tests render no dishes.
vi.mock("./dish-card", () => ({ DishCard: () => null }));

const data = {
  hasAccess: true,
  usingDefaultTarget: false,
  targetKcal: 1600,
  slots: [],
  eatenSlots: [],
};

describe("MenuView", () => {
  it("says up front that the menu is only an example and not a personal diet", () => {
    const html = renderToStaticMarkup(createElement(MenuView, { data, day: "2026-10-27" }));
    expect(SAMPLE_MENU_NOTE).toContain("примерно меню");
    expect(SAMPLE_MENU_NOTE).toContain("лекар или диетолог");
    expect(html).toContain(SAMPLE_MENU_NOTE);
  });

  it("shows no note without access, only the way to a plan", () => {
    const html = renderToStaticMarkup(
      createElement(MenuView, { data: { ...data, hasAccess: false }, day: "2026-10-27" }),
    );
    expect(html).not.toContain("примерно меню");
  });
});
