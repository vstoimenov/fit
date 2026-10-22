import { describe, expect, it } from "vitest";
import { APP_NAV, activeNavHref, navHidden } from "./app-nav";

describe("APP_NAV", () => {
  it("lists the four tabs in order", () => {
    expect(APP_NAV.map((i) => [i.href, i.label])).toEqual([
      ["/app", "Начало"],
      ["/app/library", "Тренировки"],
      ["/app/learn", "Полезно"],
      ["/app/profile", "Профил"],
    ]);
  });
});

describe("activeNavHref", () => {
  it.each([
    ["/app", "/app"],
    ["/app/library", "/app/library"],
    ["/app/library/x", "/app/library"],
    ["/app/progress", "/app/profile"],
    ["/app/check-in", "/app/profile"],
    ["/app/learn", "/app/learn"],
    ["/app/learn/some-article", "/app/learn"],
    ["/app/profile", "/app/profile"],
    ["/app/plan", "/app/profile"],
  ])("%s -> %s", (path, href) => {
    expect(activeNavHref(path)).toBe(href);
  });

  it("marks no tab on the welcome screen or unknown paths", () => {
    expect(activeNavHref("/app/welcome")).toBeNull();
    expect(activeNavHref("/app/unknown")).toBeNull();
  });

  it("does not match sibling prefixes", () => {
    expect(activeNavHref("/app/library-old")).toBeNull();
    expect(activeNavHref("/app/learner")).toBeNull();
  });
});

describe("navHidden", () => {
  it("hides on the workout route only", () => {
    expect(navHidden("/app/workout/abc")).toBe(true);
    expect(navHidden("/app")).toBe(false);
    expect(navHidden("/app/library")).toBe(false);
  });
});
