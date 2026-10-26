import { describe, expect, it } from "vitest";
import { CODE_LENGTH, formatCode, generateCode, normalizeCode } from "./code";

describe("gift codes", () => {
  it("generates codes from the unambiguous alphabet, never twice the same in a sample", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
    }
  });

  it("normalises what a person types: case, dashes, spaces, the IAM prefix", () => {
    expect(normalizeCode(" iam-abcd-efgh23 ")).toBe("ABCDEFGH23");
    expect(normalizeCode("ABCD EFGH 23")).toBe("ABCDEFGH23");
    expect(normalizeCode("")).toBe("");
  });

  it("formats for print as IAM-XXXXX-XXXXX", () => {
    expect(formatCode("ABCDEFGH23")).toBe("IAM-ABCDE-FGH23");
  });
});
