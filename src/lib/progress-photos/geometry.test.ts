import { describe, expect, it } from "vitest";
import { coverCrop, scaleToMax } from "./geometry";

describe("scaleToMax", () => {
  it("scales a landscape image so its long side is the max", () => {
    expect(scaleToMax(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait image so its long side is the max", () => {
    expect(scaleToMax(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales an image that is already small enough", () => {
    expect(scaleToMax(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("keeps the short side at least 1 px", () => {
    const size = scaleToMax(1601, 1, 1600);
    expect(size.width).toBe(1600);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("returns integer sizes", () => {
    const size = scaleToMax(4032, 3024, 1600);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });
});

describe("coverCrop", () => {
  it("crops the sides of a landscape source to a portrait share frame", () => {
    expect(coverCrop(4000, 3000, 1080, 1350)).toEqual({ sx: 800, sy: 0, sw: 2400, sh: 3000 });
  });

  it("crops the top and bottom of a tall source to a narrow half frame", () => {
    expect(coverCrop(3000, 4000, 540, 1350)).toEqual({ sx: 700, sy: 0, sw: 1600, sh: 4000 });
  });

  it("takes the whole image when the aspect ratios already match", () => {
    expect(coverCrop(1080, 1350, 1080, 1350)).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1350 });
  });

  it("stays inside the source bounds", () => {
    const sources = [
      [4000, 3000],
      [3000, 4000],
      [1080, 1350],
      [1, 5000],
      [5000, 1],
    ];
    const frames = [
      [1080, 1350],
      [540, 1350],
    ];
    for (const [srcW, srcH] of sources) {
      for (const [dstW, dstH] of frames) {
        const c = coverCrop(srcW, srcH, dstW, dstH);
        expect(c.sx).toBeGreaterThanOrEqual(0);
        expect(c.sy).toBeGreaterThanOrEqual(0);
        expect(c.sw).toBeGreaterThan(0);
        expect(c.sh).toBeGreaterThan(0);
        expect(c.sx + c.sw).toBeLessThanOrEqual(srcW);
        expect(c.sy + c.sh).toBeLessThanOrEqual(srcH);
      }
    }
  });
});
