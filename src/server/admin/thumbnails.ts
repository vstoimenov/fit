import { randomUUID } from "node:crypto";
import type { TypedClient } from "@/server/db/types";
import { THUMBNAIL_HOSTS } from "./video-meta";

const MAX_BYTES = 2 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  if (url.protocol !== "https:" || !THUMBNAIL_HOSTS.has(url.hostname)) return null;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const ext = EXT[type];
    if (!res.ok || !ext) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
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
