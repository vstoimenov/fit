import { describe, expect, it } from "vitest";
import { normalizeVideoInput, parseVideoUrl } from "./parse-video-url";

const yt = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;

describe("parseVideoUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=ml6cT4AZdqI", "ml6cT4AZdqI"],
    ["https://youtube.com/watch?v=ml6cT4AZdqI&t=42s", "ml6cT4AZdqI"],
    ["https://m.youtube.com/watch?v=ml6cT4AZdqI&feature=share", "ml6cT4AZdqI"],
    ["https://youtu.be/ml6cT4AZdqI?si=AbCdEf123", "ml6cT4AZdqI"],
    ["https://www.youtube.com/shorts/ml6cT4AZdqI", "ml6cT4AZdqI"],
    ["https://www.youtube.com/embed/ml6cT4AZdqI", "ml6cT4AZdqI"],
    ["https://www.youtube.com/live/ml6cT4AZdqI?feature=shared", "ml6cT4AZdqI"],
    ["  https://youtu.be/ml6cT4AZdqI  ", "ml6cT4AZdqI"],
  ])("reads YouTube link %s", (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ provider: "youtube", id, embedUrl: yt(id) });
  });

  it("reads a public and an unlisted Vimeo link", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({
      provider: "vimeo",
      id: "76979871",
      embedUrl: "https://player.vimeo.com/video/76979871?dnt=1",
    });
    expect(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")?.embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1&h=8272103f6e",
    );
    expect(parseVideoUrl("https://player.vimeo.com/video/76979871?h=8272103f6e")?.embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1&h=8272103f6e",
    );
  });

  it("reads Bunny embed and play links", () => {
    const guid = "0c1f6d0e-7c2a-4d8e-9a55-2f8a6b1e9c11";
    const expected = {
      provider: "bunny",
      id: `123456/${guid}`,
      embedUrl: `https://iframe.mediadelivery.net/embed/123456/${guid}?responsive=true`,
    };
    expect(parseVideoUrl(`https://iframe.mediadelivery.net/embed/123456/${guid}`)).toEqual(
      expected,
    );
    expect(parseVideoUrl(`https://iframe.mediadelivery.net/play/123456/${guid}`)).toEqual(expected);
    expect(
      parseVideoUrl(`https://player.mediadelivery.net/embed/123456/${guid}?autoplay=true`),
    ).toEqual(expected);
  });

  it.each([
    "",
    "not a url",
    "https://example.com/watch?v=ml6cT4AZdqI",
    "https://www.youtube.com/watch?v=short",
    "javascript:alert(1)",
    "https://vimeo.com/channels/staffpicks",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

describe("scheme-less and hostile input", () => {
  it("accepts links pasted without https://", () => {
    expect(parseVideoUrl("youtu.be/ml6cT4AZdqI")?.id).toBe("ml6cT4AZdqI");
    expect(parseVideoUrl("www.youtube.com/watch?v=ml6cT4AZdqI")?.id).toBe("ml6cT4AZdqI");
    expect(normalizeVideoInput(" youtu.be/ml6cT4AZdqI ")).toBe("https://youtu.be/ml6cT4AZdqI");
    expect(normalizeVideoInput("https://youtu.be/ml6cT4AZdqI")).toBe(
      "https://youtu.be/ml6cT4AZdqI",
    );
  });

  it.each([
    "https://youtube.com.evil.com/watch?v=ml6cT4AZdqI",
    "https://evilyoutube.com/watch?v=ml6cT4AZdqI",
    "https://youtube.com@evil.com/watch?v=ml6cT4AZdqI",
    "ftp://youtu.be/ml6cT4AZdqI",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });

  it("accepts an uppercase host", () => {
    expect(parseVideoUrl("https://YOUTU.BE/ml6cT4AZdqI")?.id).toBe("ml6cT4AZdqI");
  });
});
