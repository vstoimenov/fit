import { describe, expect, it } from "vitest";
import { APP_NAV, activeNavHref, navHidden } from "./app-nav";

describe("APP_NAV", () => {
  it("lists the five tabs in order", () => {
    expect(APP_NAV.map((i) => [i.href, i.label])).toEqual([
      ["/app", "Начало"],
      ["/app/library", "Тренировки"],
      ["/app/community", "Общност"],
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
    ["/app/nutrition", "/app"],
    ["/app/nutrition/history", "/app"],
    ["/app/community", "/app/community"],
    ["/app/community/abc", "/app/community"],
    ["/app/learn", "/app/learn"],
    ["/app/learn/some-article", "/app/learn"],
    ["/app/profile", "/app/profile"],
    ["/app/plan", "/app/profile"],
    ["/app/challenges", "/app"],
    ["/app/challenges/abc", "/app"],
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
    expect(activeNavHref("/app/nutrition-old")).toBeNull();
    expect(activeNavHref("/app/challenges-old")).toBeNull();
  });
});

describe("navHidden", () => {
  it("hides on the workout route only", () => {
    expect(navHidden("/app/workout/abc")).toBe(true);
    expect(navHidden("/app")).toBe(false);
    expect(navHidden("/app/library")).toBe(false);
  });
});
