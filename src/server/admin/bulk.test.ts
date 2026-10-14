import { describe, expect, it, vi } from "vitest";
import { previewLinks } from "./bulk";

const meta = vi.fn(async () => ({
  title: "От YouTube",
  durationMin: null,
  thumbnailSourceUrl: "https://i.ytimg.com/vi/x/hq.jpg",
}));

describe("previewLinks", () => {
  it("parses good lines, reports bad and duplicate ones, skips blanks", async () => {
    const text = [
      "https://youtu.be/ml6cT4AZdqI",
      "",
      "youtu.be/ml6cT4AZdqA",
      "https://example.com/video",
      "https://www.youtube.com/watch?v=ml6cT4AZdqI",
      "   ",
    ].join("\n");
    const rows = await previewLinks(text, meta);
    expect(rows.map((r) => [r.line, r.ok, r.error ?? null])).toEqual([
      [1, true, null],
      [3, true, null],
      [4, false, "Не е видео линк (YouTube, Vimeo, Bunny)."],
      [5, false, "Повтаря ред 1."],
    ]);
    expect(rows[1]).toMatchObject({
      videoUrl: "https://youtu.be/ml6cT4AZdqA",
      title: "От YouTube",
      durationMin: 30,
    });
  });

  it("caps the number of lines", async () => {
    const text = Array.from(
      { length: 40 },
      (_, i) => `https://youtu.be/ml6cT4AZd${String(i).padStart(2, "0")}`,
    ).join("\n");
    const rows = await previewLinks(text, meta);
    expect(rows).toHaveLength(31);
    expect(rows.at(-1)).toMatchObject({ ok: false, error: "Наведнъж до 30 линка." });
  });
});
