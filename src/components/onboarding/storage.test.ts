import { describe, expect, it } from "vitest";
import { DRAFT_MAX_AGE_MS, isDraftFresh, parseDraft } from "./storage";

describe("isDraftFresh", () => {
  const now = 1_800_000_000_000;
  it("keeps a draft younger than 24 hours", () => {
    expect(isDraftFresh({ savedAt: now - 1000 }, now)).toBe(true);
    expect(isDraftFresh({ savedAt: now - DRAFT_MAX_AGE_MS }, now)).toBe(true);
  });
  it("drops older drafts, drafts without a timestamp and missing drafts", () => {
    expect(isDraftFresh({ savedAt: now - DRAFT_MAX_AGE_MS - 1 }, now)).toBe(false);
    expect(isDraftFresh({ name: "Мария" }, now)).toBe(false);
    expect(isDraftFresh({ savedAt: now + 60_000 }, now)).toBe(false);
    expect(isDraftFresh(null, now)).toBe(false);
  });
});

describe("parseDraft", () => {
  it("returns null for broken or non-object JSON", () => {
    expect(parseDraft("{nope")).toBeNull();
    expect(parseDraft("42")).toBeNull();
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('{"name":"А"}')).toEqual({ name: "А" });
  });
});
