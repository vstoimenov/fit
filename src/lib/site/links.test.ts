import { describe, expect, it } from "vitest";
import { parseSiteLinks } from "./links";

describe("parseSiteLinks", () => {
  it("accepts a YouTube link for the trainer video and an Instagram profile", () => {
    expect(
      parseSiteLinks({
        trainerVideoUrl: "youtu.be/ml6cT4AZdqI",
        instagramUrl: "instagram.com/iamstrong.bg",
      }),
    ).toEqual({
      ok: true,
      links: {
        trainerVideoUrl: "https://youtu.be/ml6cT4AZdqI",
        instagramUrl: "https://instagram.com/iamstrong.bg",
      },
    });
  });

  it("lets both be cleared", () => {
    expect(parseSiteLinks({ trainerVideoUrl: "  ", instagramUrl: "" })).toEqual({
      ok: true,
      links: { trainerVideoUrl: "", instagramUrl: "" },
    });
  });

  it("rejects a video link no player can embed", () => {
    const res = parseSiteLinks({
      trainerVideoUrl: "https://example.com/video.mp4",
      instagramUrl: "",
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.message).toMatch(/YouTube|Vimeo|Bunny/);
  });

  it("rejects an Instagram link that is not instagram.com", () => {
    const res = parseSiteLinks({
      trainerVideoUrl: "",
      instagramUrl: "https://evil.example/iamstrong",
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.message).toMatch(/Instagram/);
  });
});
