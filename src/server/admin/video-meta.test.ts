import { describe, expect, it, vi } from "vitest";
import { parseVideoUrl } from "@/lib/video/parse-video-url";
import { fetchVideoMeta } from "./video-meta";

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status: ok ? 200 : 404 }),
  ) as unknown as typeof fetch;
}

describe("fetchVideoMeta", () => {
  it("reads title and thumbnail from YouTube oEmbed (no duration)", async () => {
    const f = fakeFetch({
      title: "Корем 20",
      thumbnail_url: "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg",
    });
    const meta = await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, f);
    expect(meta).toEqual({
      title: "Корем 20",
      durationMin: null,
      thumbnailSourceUrl: "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg",
    });
    const called = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(called).toBe(
      "https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dml6cT4AZdqI",
    );
  });

  it("reads duration from Vimeo and keeps the unlisted hash", async () => {
    const f = fakeFetch({
      title: "Стречинг",
      duration: 1530,
      thumbnail_url: "https://i.vimeocdn.com/video/1.jpg",
    });
    const meta = await fetchVideoMeta(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")!, f);
    expect(meta).toEqual({
      title: "Стречинг",
      durationMin: 26,
      thumbnailSourceUrl: "https://i.vimeocdn.com/video/1.jpg",
    });
    const called = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(called).toContain(encodeURIComponent("https://vimeo.com/76979871/8272103f6e"));
  });

  it("drops thumbnails from unexpected hosts and survives errors", async () => {
    const evil = fakeFetch({ title: "x", thumbnail_url: "https://evil.example/x.jpg" });
    expect(
      (await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, evil))
        .thumbnailSourceUrl,
    ).toBeNull();
    const down = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, down)).toEqual({
      title: null,
      durationMin: null,
      thumbnailSourceUrl: null,
    });
    const missing = fakeFetch({}, false);
    expect(
      (await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, missing)).title,
    ).toBeNull();
  });

  it("returns nothing for Bunny (no oEmbed)", async () => {
    const f = fakeFetch({});
    const ref = parseVideoUrl(
      "https://iframe.mediadelivery.net/embed/123456/0c1f6d0e-7c2a-4d8e-9a55-2f8a6b1e9c11",
    )!;
    expect(await fetchVideoMeta(ref, f)).toEqual({
      title: null,
      durationMin: null,
      thumbnailSourceUrl: null,
    });
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it("refuses redirects on the provider fetch and survives a rejected redirect", async () => {
    const f = fakeFetch({ title: "x" });
    await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, f);
    const init = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]![1];
    expect(init.redirect).toBe("error");
    const redirected = vi.fn(async () => {
      throw new TypeError("fetch failed: unexpected redirect");
    }) as unknown as typeof fetch;
    expect(
      await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, redirected),
    ).toEqual({
      title: null,
      durationMin: null,
      thumbnailSourceUrl: null,
    });
  });

  it("drops thumbnails with an explicit port", async () => {
    const f = fakeFetch({ title: "x", thumbnail_url: "https://i.ytimg.com:8443/x.jpg" });
    expect(
      (await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, f)).thumbnailSourceUrl,
    ).toBeNull();
  });
});
