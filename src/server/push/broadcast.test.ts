import { describe, expect, it } from "vitest";
import { broadcastSchema } from "./broadcast";

describe("broadcastSchema", () => {
  it("accepts a short title and body with an app link", () => {
    expect(
      broadcastSchema.parse({ title: " Нова лекция ", body: "Четвъртък 19:00", url: "/app/learn" }),
    ).toEqual({ title: "Нова лекция", body: "Четвъртък 19:00", url: "/app/learn" });
  });

  it("treats an empty link as none and rejects links off the app", () => {
    expect(broadcastSchema.parse({ title: "A", body: "B", url: "" }).url).toBeNull();
    expect(() =>
      broadcastSchema.parse({ title: "A", body: "B", url: "https://evil.example" }),
    ).toThrow();
    expect(() =>
      broadcastSchema.parse({ title: "A", body: "B", url: "javascript:alert(1)" }),
    ).toThrow();
  });

  it("caps the lengths a notification can show", () => {
    expect(() => broadcastSchema.parse({ title: "x".repeat(81), body: "B", url: "" })).toThrow();
    expect(() => broadcastSchema.parse({ title: "A", body: "x".repeat(201), url: "" })).toThrow();
  });
});

describe("broadcastSchema links", () => {
  it("refuses links that only look app-relative", () => {
    // "/\evil.com" and "//evil.com" resolve to https://evil.com/ in a browser.
    expect(() => broadcastSchema.parse({ title: "A", body: "B", url: "/\\evil.com" })).toThrow();
    expect(() => broadcastSchema.parse({ title: "A", body: "B", url: "//evil.com" })).toThrow();
    expect(broadcastSchema.parse({ title: "A", body: "B", url: "/app/learn?x=1" }).url).toBe(
      "/app/learn?x=1",
    );
  });
});
