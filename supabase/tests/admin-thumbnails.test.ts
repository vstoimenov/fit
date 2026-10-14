import { beforeAll, describe, expect, it, vi } from "vitest";
import { copyThumbnail } from "@/server/admin/thumbnails";
import { adminClient, createAdminUser, type TypedClient } from "./helpers";

// 1×1 transparent PNG
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ),
  (c) => c.charCodeAt(0),
);
let boss: TypedClient;

beforeAll(async () => {
  boss = (await createAdminUser(adminClient(), "thumb-admin")).db;
});

const image = () =>
  vi.fn(
    async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } }),
  ) as unknown as typeof fetch;

describe("copyThumbnail", () => {
  it("stores the image under a random name in our bucket", async () => {
    const url = await copyThumbnail(
      boss,
      "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg",
      image(),
    );
    expect(url).toMatch(/\/storage\/v1\/object\/public\/thumbnails\/[0-9a-f-]{36}\.png$/);
    expect(url).not.toContain("ml6cT4AZdqI");
    expect((await fetch(url!)).status).toBe(200);
  });

  it("refuses foreign hosts, non-images and failures", async () => {
    expect(await copyThumbnail(boss, "https://evil.example/x.png", image())).toBeNull();
    const html = vi.fn(
      async () => new Response("<html>", { headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    expect(await copyThumbnail(boss, "https://i.ytimg.com/x.jpg", html)).toBeNull();
    const down = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    expect(await copyThumbnail(boss, "https://i.ytimg.com/x.jpg", down)).toBeNull();
  });
});
