import { scaleToMax, UPLOAD_MAX_SIDE, UPLOAD_QUALITY } from "./geometry";
import { PhotoDecodeError } from "./upload-errors";

/**
 * Re-encodes a chosen photo as a JPEG with the long side at most 1600 px. Browser only (canvas). The
 * re-encode also drops EXIF (location, camera); the orientation is applied to the pixels first.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoDecodeError();
  }
  try {
    const { width, height } = scaleToMax(bitmap.width, bitmap.height, UPLOAD_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoDecodeError();
    // JPEG has no alpha: paint white first so a transparent PNG does not turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_QUALITY),
    );
    if (!blob) throw new PhotoDecodeError();
    return blob;
  } finally {
    bitmap.close();
  }
}
