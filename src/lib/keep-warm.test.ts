import { describe, expect, it } from "vitest";
import { isKeepWarmRequest } from "./keep-warm";

describe("isKeepWarmRequest", () => {
  it("is true only when the header equals the configured secret", () => {
    expect(isKeepWarmRequest("s3cret-s3cret-s3cret", "s3cret-s3cret-s3cret")).toBe(true);
    expect(isKeepWarmRequest("s3cret-s3cret-s3creX", "s3cret-s3cret-s3cret")).toBe(false);
    expect(isKeepWarmRequest("s3cret", "s3cret-s3cret-s3cret")).toBe(false);
  });

  it("is false without a header or without a configured secret", () => {
    expect(isKeepWarmRequest(null, "s3cret-s3cret-s3cret")).toBe(false);
    expect(isKeepWarmRequest("", "s3cret-s3cret-s3cret")).toBe(false);
    expect(isKeepWarmRequest("anything", undefined)).toBe(false);
    expect(isKeepWarmRequest("", "")).toBe(false);
  });
});
