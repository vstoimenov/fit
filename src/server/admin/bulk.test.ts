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

  it("caps the number of valid links, junk does not count", async () => {
    const valid = Array.from(
      { length: 40 },
      (_, i) => `https://youtu.be/ml6cT4AZd${String(i).padStart(2, "0")}`,
    );
    const rows = await previewLinks(valid.join("\n"), meta);
    expect(rows).toHaveLength(31);
    expect(rows.filter((r) => r.ok)).toHaveLength(30);
    expect(rows.at(-1)).toMatchObject({ ok: false, error: "Наведнъж до 30 линка." });

    const mixed = valid.slice(0, 30).flatMap((l, i) => (i % 6 === 0 ? ["junk", l] : [l]));
    const rows2 = await previewLinks(mixed.join("\n"), meta);
    expect(rows2.filter((r) => r.ok)).toHaveLength(30);
    expect(rows2.filter((r) => !r.ok).every((r) => r.error?.startsWith("Не е видео"))).toBe(true);
  });

  it("numbers default titles among valid rows", async () => {
    const none = async () => ({ title: null, durationMin: null, thumbnailSourceUrl: null });
    const rows = await previewLinks(
      "junk\nhttps://youtu.be/ml6cT4AZdqI\nnope\nhttps://youtu.be/ml6cT4AZdqA",
      none,
    );
    expect(rows.filter((r) => r.ok).map((r) => r.title)).toEqual(["Тренировка 1", "Тренировка 2"]);
  });

  it("keeps input order and limits concurrency to 5 with slow lookups", async () => {
    let active = 0;
    let peak = 0;
    const slow = async (ref: { id: string }) => {
      active++;
      peak = Math.max(peak, active);
      // earlier links take longer, so completion order is the reverse of input order
      await new Promise((r) => setTimeout(r, 40 - Number(ref.id.slice(-2))));
      active--;
      return { title: `T ${ref.id.slice(-2)}`, durationMin: 10, thumbnailSourceUrl: null };
    };
    const text = Array.from(
      { length: 12 },
      (_, i) => `https://youtu.be/ml6cT4AZd${String(i).padStart(2, "0")}`,
    ).join("\n");
    const rows = await previewLinks(text, slow);
    expect(rows.map((r) => r.title)).toEqual(
      Array.from({ length: 12 }, (_, i) => `T ${String(i).padStart(2, "0")}`),
    );
    expect(peak).toBe(5);
  });
});
