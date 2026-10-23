import { PhotoDecodeError } from "./upload-errors";

/** A decoded picture the canvas can draw, with its size and a way to release it. */
export type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
};

function fromBitmap(bitmap: ImageBitmap): DecodedImage {
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    close: () => bitmap.close(),
  };
}

/** Last resort for browsers whose createImageBitmap rejects the file: an <img> from an object URL. */
async function viaImageElement(blob: Blob): Promise<DecodedImage> {
  const href = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = href;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(href);
  }
}

/**
 * Opens a picture for drawing, with the EXIF orientation applied. Tries createImageBitmap with the
 * orientation option; some WebKit versions throw a TypeError for the option, so it is retried without
 * options, and finally decoded through an <img>. Only when all three fail is it a PhotoDecodeError.
 * Browser only.
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  try {
    return fromBitmap(await createImageBitmap(blob, { imageOrientation: "from-image" }));
  } catch (first) {
    if (first instanceof TypeError) {
      try {
        return fromBitmap(await createImageBitmap(blob));
      } catch {
        // Fall through to the <img> route.
      }
    }
  }
  try {
    return await viaImageElement(blob);
  } catch {
    throw new PhotoDecodeError();
  }
}
