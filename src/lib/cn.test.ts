import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("lets a later conflicting class win", () => {
    expect(cn("p-4", "p-6")).toBe("p-6");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("keeps non-conflicting classes", () => {
    expect(cn("rounded-2xl bg-sand", "p-0")).toBe("rounded-2xl bg-sand p-0");
  });
});
