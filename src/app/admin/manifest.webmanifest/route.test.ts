import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("admin manifest", () => {
  it("describes a separate home-screen app scoped to /admin with its own icons", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toContain("application/manifest+json");
    const json = await res.json();
    expect(json.start_url).toBe("/admin");
    expect(json.scope).toBe("/admin");
    expect(json.short_name).toBe("Админ");
    expect(json.name).toContain("I AM STRONG");
    expect(json.display).toBe("standalone");
    const srcs = json.icons.map((i: { src: string }) => i.src);
    expect(srcs).toHaveLength(3);
    expect(srcs[0]).toMatch(/^\/pwa-icon\/192\?.*variant=admin/);
    expect(srcs[1]).toMatch(/^\/pwa-icon\/512\?.*variant=admin/);
    expect(json.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  });
});
