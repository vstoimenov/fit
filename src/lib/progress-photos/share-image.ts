import { formatLongDate } from "./format-date";
import { coverCrop, DIVIDER, SHARE_H, SHARE_W } from "./geometry";

export const SHARE_FILE_NAME = "progres.jpg";

const SHARE_QUALITY = 0.9;
const INK = "#111111";
const POWDER = "#E5A9AE";
const WHITE = "#ffffff";
const MARGIN = 56;
const FAMILY = 'Manrope, "Helvetica Neue", Arial, sans-serif';

type Dated = { url: string; takenOn: string };

let fonts: Promise<void> | null = null;

/** Loads the two Manrope weights once. A font that fails to load falls back to the system sans. */
function loadFonts(): Promise<void> {
  fonts ??= (async () => {
    try {
      const faces = [
        new FontFace("Manrope", "url(/fonts/manrope-800.ttf)", { weight: "800" }),
        new FontFace("Manrope", "url(/fonts/manrope-400.ttf)", { weight: "400" }),
      ];
      await Promise.all(faces.map((face) => face.load()));
      for (const face of faces) document.fonts.add(face);
    } catch {
      fonts = null;
    }
  })();
  return fonts;
}

/** The signed URL's body as a bitmap. A blob (not an <img>) so the canvas is never tainted. */
async function loadBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`photo ${response.status}`);
  return createImageBitmap(await response.blob(), { imageOrientation: "from-image" });
}

type Context = CanvasRenderingContext2D;

function drawCover(ctx: Context, bitmap: ImageBitmap, x: number, y: number, w: number, h: number) {
  const { sx, sy, sw, sh } = coverCrop(bitmap.width, bitmap.height, w, h);
  ctx.drawImage(bitmap, sx, sy, sw, sh, x, y, w, h);
}

function roundedRect(ctx: Context, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Ink fading in over the lower part of the picture, so white text stays legible on any photo. */
function drawBottomGradient(ctx: Context) {
  const top = SHARE_H - 560;
  const gradient = ctx.createLinearGradient(0, top, 0, SHARE_H);
  gradient.addColorStop(0, "rgba(17, 17, 17, 0)");
  gradient.addColorStop(1, "rgba(17, 17, 17, 0.88)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, SHARE_W, SHARE_H - top);
}

const PILL_H = 72;
const HOST_SIZE = 26;
const HOST_GAP = 14;

/** Size of the badge (pill with the host under it) for the given host. */
function badgeSize(
  ctx: Context,
  host: string,
): { width: number; height: number; pillWidth: number } {
  ctx.font = `800 32px ${FAMILY}`;
  // Dot (30 px in from the edge, 9 px radius), a 14 px gap, the name, then 21 px of padding.
  const pillWidth = Math.ceil(ctx.measureText("I AM STRONG").width) + 74;
  ctx.font = `400 ${HOST_SIZE}px ${FAMILY}`;
  const hostWidth = host ? Math.ceil(ctx.measureText(host).width) : 0;
  return {
    pillWidth,
    width: Math.max(pillWidth, hostWidth),
    height: PILL_H + (host ? HOST_GAP + HOST_SIZE : 0),
  };
}

/**
 * The „I AM STRONG" badge: an ink pill with a powder dot and the name in white Manrope 800, the site
 * host in white Manrope 400 under it. `centerX` is the badge's horizontal centre, `bottom` its lowest edge.
 */
function drawBadge(ctx: Context, host: string, centerX: number, bottom: number) {
  const size = badgeSize(ctx, host);
  const { pillWidth } = size;
  const top = bottom - size.height;

  ctx.fillStyle = INK;
  roundedRect(ctx, centerX - pillWidth / 2, top, pillWidth, PILL_H, PILL_H / 2);
  ctx.fill();

  ctx.fillStyle = POWDER;
  ctx.beginPath();
  ctx.arc(centerX - pillWidth / 2 + 30, top + PILL_H / 2, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = WHITE;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `800 32px ${FAMILY}`;
  ctx.fillText("I AM STRONG", centerX - pillWidth / 2 + 30 + 9 + 14, top + PILL_H / 2 + 1);

  if (host) {
    ctx.font = `400 ${HOST_SIZE}px ${FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(host, centerX, bottom - 3);
  }
}

/** A „ПРЕДИ" / „СЛЕД" chip with its date at the top of one half. */
function drawChip(
  ctx: Context,
  label: string,
  date: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const height = 64;
  const padX = 26;
  const gap = 14;
  let labelSize = 26;
  let dateSize = 24;
  const widths = () => {
    ctx.font = `800 ${labelSize}px ${FAMILY}`;
    const l = ctx.measureText(label).width;
    ctx.font = `400 ${dateSize}px ${FAMILY}`;
    return { l, d: ctx.measureText(date).width };
  };
  let w = widths();
  while (padX * 2 + w.l + gap + w.d > maxWidth && dateSize > 14) {
    labelSize -= 1;
    dateSize -= 1;
    w = widths();
  }
  const width = Math.ceil(padX * 2 + w.l + gap + w.d);

  ctx.fillStyle = "rgba(17, 17, 17, 0.82)";
  roundedRect(ctx, x, y, width, height, height / 2);
  ctx.fill();

  ctx.fillStyle = WHITE;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `800 ${labelSize}px ${FAMILY}`;
  ctx.fillText(label, x + padX, y + height / 2 + 1);
  ctx.font = `400 ${dateSize}px ${FAMILY}`;
  ctx.fillText(date, x + padX + w.l + gap, y + height / 2 + 1);
}

function drawSingle(ctx: Context, after: ImageBitmap, takenOn: string, host: string) {
  drawCover(ctx, after, 0, 0, SHARE_W, SHARE_H);
  drawBottomGradient(ctx);

  const bottom = SHARE_H - MARGIN;
  const badge = badgeSize(ctx, host);
  const badgeCenter = SHARE_W - MARGIN - badge.width / 2;
  drawBadge(ctx, host, badgeCenter, bottom);

  // The date sits level with the pill, to the left of the badge; shrink it rather than overlap.
  const date = formatLongDate(takenOn);
  const room = badgeCenter - badge.width / 2 - MARGIN - 24;
  let size = 46;
  ctx.font = `800 ${size}px ${FAMILY}`;
  while (ctx.measureText(date).width > room && size > 24) {
    size -= 2;
    ctx.font = `800 ${size}px ${FAMILY}`;
  }
  ctx.fillStyle = WHITE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(date, MARGIN, bottom - badge.height + PILL_H / 2 + 1);
}

function drawPair(
  ctx: Context,
  before: { bitmap: ImageBitmap; takenOn: string },
  after: { bitmap: ImageBitmap; takenOn: string },
  host: string,
) {
  const half = SHARE_W / 2;
  drawCover(ctx, before.bitmap, 0, 0, half, SHARE_H);
  drawCover(ctx, after.bitmap, half, 0, half, SHARE_H);
  drawBottomGradient(ctx);

  ctx.fillStyle = WHITE;
  ctx.fillRect(half - DIVIDER / 2, 0, DIVIDER, SHARE_H);

  const chipRoom = half - 2 * 30 - DIVIDER / 2;
  drawChip(ctx, "ПРЕДИ", formatLongDate(before.takenOn), 30, 36, chipRoom);
  drawChip(ctx, "СЛЕД", formatLongDate(after.takenOn), half + DIVIDER / 2 + 30, 36, chipRoom);

  drawBadge(ctx, host, SHARE_W / 2, SHARE_H - MARGIN);
}

/**
 * The branded 1080x1350 share picture as a JPEG file: one photo, or a before/after pair. Browser only.
 * The result carries nothing but the photo(s), the dates and the badge.
 */
export async function drawShareImage(input: {
  after: Dated;
  before?: Dated;
  host: string;
}): Promise<File> {
  const [, after, before] = await Promise.all([
    loadFonts(),
    loadBitmap(input.after.url),
    input.before ? loadBitmap(input.before.url) : Promise.resolve(null),
  ]);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_W;
    canvas.height = SHARE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);

    if (before && input.before) {
      drawPair(
        ctx,
        { bitmap: before, takenOn: input.before.takenOn },
        { bitmap: after, takenOn: input.after.takenOn },
        input.host,
      );
    } else {
      drawSingle(ctx, after, input.after.takenOn, input.host);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", SHARE_QUALITY),
    );
    if (!blob) throw new Error("share image encode failed");
    return new File([blob], SHARE_FILE_NAME, { type: "image/jpeg" });
  } finally {
    after.close();
    before?.close();
  }
}
