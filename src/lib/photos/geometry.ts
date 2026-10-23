export const UPLOAD_MAX_SIDE = 1600;
export const UPLOAD_QUALITY = 0.85;
export const SHARE_W = 1080;
export const SHARE_H = 1350;
export const DIVIDER = 6;
export const MAX_PHOTOS = 200;

/** Fit an image inside a square of `max` px on its long side; never upscales. */
export function scaleToMax(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Centre crop of the source that has the destination's aspect ratio. */
export function coverCrop(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const dstRatio = dstW / dstH;
  if (srcW / srcH > dstRatio) {
    const sw = clamp(Math.round(srcH * dstRatio), 1, srcW);
    return { sx: Math.round((srcW - sw) / 2), sy: 0, sw, sh: srcH };
  }
  const sh = clamp(Math.round(srcW / dstRatio), 1, srcH);
  return { sx: 0, sy: Math.round((srcH - sh) / 2), sw: srcW, sh };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
