/** The browser could not open the chosen file as an image. */
export class PhotoDecodeError extends Error {
  constructor() {
    super("photo could not be decoded");
    this.name = "PhotoDecodeError";
  }
}

const TOO_BIG = "Снимката е твърде голяма.";

function isTooBig(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, statusCode, message } = error as Record<string, unknown>;
  if (Number(status) === 413 || Number(statusCode) === 413) return true;
  return typeof message === "string" && /size/i.test(message);
}

/** A message that is safe to show for any failure while preparing or uploading a photo. */
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof PhotoDecodeError) {
    return "Не успяхме да отворим снимката. Опитай с JPG или PNG.";
  }
  if (isTooBig(error)) return TOO_BIG;
  return "Снимката не се качи. Опитай пак.";
}
