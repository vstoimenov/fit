import { describe, expect, it } from "vitest";
import { mapFreeWorkout, mapSiteLinks } from "./map";

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Първа тренировка: цяло тяло",
  duration_min: 20,
  thumbnail_url: null,
  video_url: "https://www.youtube.com/watch?v=ml6cT4AZdqI",
};

describe("mapFreeWorkout", () => {
  it("maps a YouTube workout to a nocookie embed with the focus cover as poster", () => {
    const w = mapFreeWorkout(row);
    expect(w?.title).toBe("Първа тренировка: цяло тяло");
    expect(w?.durationMin).toBe(20);
    expect(w?.video.provider).toBe("youtube");
    expect(w?.video.embedUrl).toContain("youtube-nocookie.com/embed/ml6cT4AZdqI");
    expect(w?.posterSrc).toBe("/photos/focus-full_body.jpg");
  });

  it("keeps a Vimeo workout playable and prefers the workout's own thumbnail", () => {
    const w = mapFreeWorkout({
      ...row,
      thumbnail_url: "https://cdn.example/poster.jpg",
      video_url: "https://vimeo.com/123456",
    });
    expect(w?.video.provider).toBe("vimeo");
    expect(w?.posterSrc).toBe("https://cdn.example/poster.jpg");
  });

  it("returns null without a row or with an unparseable video", () => {
    expect(mapFreeWorkout(null)).toBeNull();
    expect(mapFreeWorkout({ ...row, video_url: "not a link" })).toBeNull();
  });
});

describe("mapSiteLinks", () => {
  it("parses the trainer video and keeps the Instagram url", () => {
    expect(
      mapSiteLinks({
        instagram_url: "https://instagram.com/x",
        trainer_video_url: "https://youtu.be/ml6cT4AZdqI",
      }),
    ).toEqual({
      instagramUrl: "https://instagram.com/x",
      trainerVideo: expect.objectContaining({ provider: "youtube", id: "ml6cT4AZdqI" }),
    });
  });

  it("is all null for null, garbage or missing keys", () => {
    expect(mapSiteLinks(null)).toEqual({ instagramUrl: null, trainerVideo: null });
    expect(mapSiteLinks("x")).toEqual({ instagramUrl: null, trainerVideo: null });
    expect(mapSiteLinks({ instagram_url: null, trainer_video_url: null })).toEqual({
      instagramUrl: null,
      trainerVideo: null,
    });
  });
});
