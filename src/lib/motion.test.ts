import { describe, expect, it } from "vitest";
import { transitionFor } from "@/lib/motion";

describe("transitionFor", () => {
  it("is instant when reduced motion is requested", () => {
    expect(transitionFor(true, "page")).toEqual({ duration: 0 });
    expect(transitionFor(true, "pop")).toEqual({ duration: 0 });
  });

  it("uses a short tween for page transitions", () => {
    const t = transitionFor(false, "page") as { duration: number };
    expect(t.duration).toBeGreaterThanOrEqual(0.15);
    expect(t.duration).toBeLessThanOrEqual(0.35);
  });

  it("uses a spring for pop", () => {
    expect(transitionFor(false, "pop")).toMatchObject({ type: "spring" });
  });
});
