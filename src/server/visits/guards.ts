/** Largest body /api/visit accepts: a path, a referrer and five short UTM values fit well inside. */
export const MAX_VISIT_BODY_BYTES = 4096;

/**
 * Same-site check for the visit beacon. Browsers always send Sec-Fetch-Site and Origin on
 * cross-origin POSTs, so a spoofed page cannot make visitors' browsers pad our stats.
 */
export function isCrossSite(input: {
  secFetchSite: string | null;
  origin: string | null;
  host: string | null;
}): boolean {
  if (input.secFetchSite === "cross-site") return true;
  if (input.origin) {
    try {
      return new URL(input.origin).host !== input.host;
    } catch {
      return true;
    }
  }
  return false;
}

/** True when a declared Content-Length is already over the cap. A missing or bad header is false. */
export function declaredTooLarge(
  contentLength: string | null,
  max = MAX_VISIT_BODY_BYTES,
): boolean {
  if (contentLength === null || !/^\d+$/.test(contentLength)) return false;
  return Number(contentLength) > max;
}

/** Reads the body as text, stopping once it passes `max` bytes. Returns null when too large. */
export async function readCappedText(
  request: Request,
  max = MAX_VISIT_BODY_BYTES,
): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
