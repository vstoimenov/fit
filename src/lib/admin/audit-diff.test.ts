import { describe, expect, it } from "vitest";
import { MAX_DIFF_STRING, truncateDiff } from "./audit-diff";

describe("truncateDiff", () => {
  it("cuts long strings to the limit plus an ellipsis, at any depth", () => {
    const long = "a".repeat(MAX_DIFF_STRING + 50);
    const out = truncateDiff({ body: long, nested: { list: [long, 1] } }) as {
      body: string;
      nested: { list: [string, number] };
    };
    expect(out.body).toBe("a".repeat(MAX_DIFF_STRING) + "…");
    expect(out.nested.list[0]).toBe("a".repeat(MAX_DIFF_STRING) + "…");
    expect(out.nested.list[1]).toBe(1);
  });

  it("leaves strings at the limit, and other values, untouched", () => {
    const edge = "b".repeat(MAX_DIFF_STRING);
    const value = { edge, n: 2, ok: true, nothing: null };
    expect(truncateDiff(value)).toEqual(value);
  });

  it("does not mutate its input", () => {
    const input = { body: "c".repeat(MAX_DIFF_STRING + 1) };
    truncateDiff(input);
    expect(input.body).toHaveLength(MAX_DIFF_STRING + 1);
  });
});
