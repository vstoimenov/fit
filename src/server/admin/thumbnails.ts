import { randomUUID } from "node:crypto";
import type { TypedClient } from "@/server/db/types";
import { THUMBNAIL_HOSTS } from "./video-meta";

const MAX_BYTES = 2 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const startsWith = (bytes: Uint8Array, at: number, sig: number[]) =>
  sig.every((b, i) => bytes[at + i] === b);

/** Checks the file signature against the declared content type. */
function matchesType(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return startsWith(bytes, 0, [0xff, 0xd8, 0xff]);
  if (type === "image/png")
    return startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") {
    return (
      startsWith(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes, 8, [0x57, 0x45, 0x42, 0x50])
    );
  }
  return false;
}

/** Reads the body, aborting as soon as it exceeds MAX_BYTES. Null when too large. */
async function readCapped(res: Response): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const out = new Uint8Array(MAX_BYTES);
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    out.set(value, size);
    size += value.byteLength;
  }
  return out.slice(0, size);
}

/**
 * Copies a provider thumbnail into our public bucket under a random name, so the stored URL never
 * contains the video ID. Uses the admin's session (storage RLS: admins only). Null on any failure.
 */
export async function copyThumbnail(
  db: TypedClient,
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "" || !THUMBNAIL_HOSTS.has(url.hostname))
    return null;
  try {
    const res = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const ext = EXT[type];
    if (!res.ok || !ext) return null;
    const bytes = await readCapped(res);
    if (!bytes || bytes.byteLength === 0 || !matchesType(bytes, type)) return null;
    const path = `${randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from("thumbnails")
      .upload(path, bytes, { contentType: type });
    if (error) return null;
    return db.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
