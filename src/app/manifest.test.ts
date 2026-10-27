import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("member manifest", () => {
  it("versions the icon urls so phones refetch a changed design", () => {
    const icons = manifest().icons ?? [];
    expect(icons).toHaveLength(3);
    for (const icon of icons) expect(icon.src).toMatch(/^\/pwa-icon\/(192|512)\?v=\d+$/);
  });
});
