import { describe, expect, it } from "vitest";
import { isAbort } from "./browser";

describe("isAbort", () => {
  it("is true for an AbortError DOMException", () => {
    expect(isAbort(new DOMException("closed", "AbortError"))).toBe(true);
  });

  it("is false for other errors", () => {
    expect(isAbort(new DOMException("nope", "NotAllowedError"))).toBe(false);
    expect(isAbort(new Error("AbortError"))).toBe(false);
    expect(isAbort(null)).toBe(false);
  });
});
