import { describe, expect, it } from "vitest";
import { coverIsUnoptimized } from "./article-card";

describe("coverIsUnoptimized", () => {
  it("optimises only plain local paths", () => {
    expect(coverIsUnoptimized("/photos/a.jpg")).toBe(false);
    expect(coverIsUnoptimized("https://x.bg/a.jpg")).toBe(true);
    expect(coverIsUnoptimized("/photos/a.jpg?v=1")).toBe(true);
    expect(coverIsUnoptimized("/photos/a.jpg#x")).toBe(true);
  });
});
