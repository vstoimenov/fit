import { describe, expect, it, vi } from "vitest";
import type { TypedClient } from "@/server/db/types";
import { copyThumbnail } from "./thumbnails";

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

function fakeDb() {
  const upload = vi.fn(async () => ({ error: null }));
  const db = {
    storage: {
      from: () => ({
        upload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `http://stub/${path}` } }),
      }),
    },
  } as unknown as TypedClient;
  return { db, upload };
}

const respond = (bytes: Uint8Array | string, type: string, headers: Record<string, string> = {}) =>
  vi.fn(
    async () =>
      new Response(bytes as BodyInit, {
        status: 200,
        headers: { "content-type": type, ...headers },
      }),
  ) as unknown as typeof fetch;

const init = (f: typeof fetch) =>
  (f as unknown as { mock: { calls: [unknown, RequestInit][] } }).mock.calls[0]![1];

describe("copyThumbnail (guards)", () => {
  it("refuses redirects and treats a rejected redirect as failure", async () => {
    const { db } = fakeDb();
    const f = respond(Uint8Array.from(PNG_HEAD), "image/png");
    await copyThumbnail(db, "https://i.ytimg.com/x.png", f);
    expect(init(f).redirect).toBe("error");
    const redirected = vi.fn(async () => {
      throw new TypeError("unexpected redirect");
    }) as unknown as typeof fetch;
    expect(await copyThumbnail(db, "https://i.ytimg.com/x.png", redirected)).toBeNull();
  });

  it("refuses an explicit port without fetching", async () => {
    const { db } = fakeDb();
    const f = respond(Uint8Array.from(PNG_HEAD), "image/png");
    expect(await copyThumbnail(db, "https://i.ytimg.com:8443/x.jpg", f)).toBeNull();
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it("accepts png, jpeg and webp signatures", async () => {
    for (const [head, type] of [
      [PNG_HEAD, "image/png"],
      [JPG_HEAD, "image/jpeg"],
      [WEBP_HEAD, "image/webp"],
    ] as const) {
      const { db, upload } = fakeDb();
      expect(
        await copyThumbnail(db, "https://i.ytimg.com/x", respond(Uint8Array.from(head), type)),
      ).not.toBeNull();
      expect(upload).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects bytes that do not match the declared type", async () => {
    const { db, upload } = fakeDb();
    expect(
      await copyThumbnail(
        db,
        "https://i.ytimg.com/x.png",
        respond("<html>not an image</html>", "image/png"),
      ),
    ).toBeNull();
    expect(
      await copyThumbnail(
        db,
        "https://i.ytimg.com/x.jpg",
        respond(Uint8Array.from(PNG_HEAD), "image/jpeg"),
      ),
    ).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects oversized images by header and by streamed size", async () => {
    const { db, upload } = fakeDb();
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG_HEAD);
    const byHeader = respond(Uint8Array.from(PNG_HEAD), "image/png", {
      "content-length": String(big.byteLength),
    });
    expect(await copyThumbnail(db, "https://i.ytimg.com/x.png", byHeader)).toBeNull();
    expect(
      await copyThumbnail(db, "https://i.ytimg.com/x.png", respond(big, "image/png")),
    ).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});
