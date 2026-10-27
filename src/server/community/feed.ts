import "server-only";

import type { TypedClient } from "@/server/db/types";
import { parseFeed, parsePost, type FeedPost, type PostDetail } from "./parse";

export const PAGE_SIZE = 20;
const BUCKET = "community-photos";
const SIGNED_URL_TTL = 60 * 60;

/** Signs the photos of the given posts with the viewer's own client (storage RLS: members with access). */
async function withPhotoUrls<T extends { photoPath: string | null; photoUrl: string | null }>(
  db: TypedClient,
  posts: T[],
): Promise<T[]> {
  const paths = posts.map((p) => p.photoPath).filter((p): p is string => p !== null);
  if (paths.length === 0) return posts;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) {
    console.error("community photo urls failed", error.message);
    return posts;
  }
  const byPath = new Map(data.map((d) => [d.path, d.signedUrl] as const));
  return posts.map((p) => ({
    ...p,
    photoUrl: p.photoPath ? (byPath.get(p.photoPath) ?? null) : null,
  }));
}

/** One page of the feed, newest first; `before` is the last post's `createdAt` of the previous page. */
export async function listFeed(
  db: TypedClient,
  before: string | null = null,
  limit = PAGE_SIZE,
): Promise<{ posts: FeedPost[]; hasMore: boolean }> {
  const { data, error } = await db.rpc("community_feed", {
    p_before: before ?? "",
    p_limit: limit + 1,
  });
  if (error) throw new Error(`load community feed failed: ${error.message}`);
  const rows = parseFeed(data);
  const page = rows.slice(0, limit);
  return { posts: await withPhotoUrls(db, page), hasMore: rows.length > limit };
}

export async function getPost(db: TypedClient, id: string): Promise<PostDetail | null> {
  const { data, error } = await db.rpc("community_post", { p_id: id });
  if (error) throw new Error(`load community post failed: ${error.message}`);
  const post = parsePost(data);
  if (!post) return null;
  const [signed] = await withPhotoUrls(db, [post]);
  return signed ?? post;
}
