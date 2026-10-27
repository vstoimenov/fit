import { z } from "zod";

const postRow = z.object({
  id: z.uuid(),
  body: z.string(),
  photo_path: z.string().nullable(),
  completion_id: z.string().nullable(),
  created_at: z.string(),
  hidden: z.boolean(),
  mine: z.boolean(),
  author_name: z.string(),
  hearts: z.number(),
  hearted_by_me: z.boolean(),
});

const commentRow = z.object({
  id: z.string(),
  body: z.string(),
  created_at: z.string(),
  mine: z.boolean(),
  author_name: z.string(),
});

export interface FeedPost {
  id: string;
  body: string;
  photoPath: string | null;
  /** Signed URL, filled in by the server when the post has a photo. */
  photoUrl: string | null;
  completionId: string | null;
  createdAt: string;
  hidden: boolean;
  mine: boolean;
  authorName: string;
  hearts: number;
  comments: number;
  heartedByMe: boolean;
}

export interface PostComment {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  authorName: string;
}

export type PostDetail = Omit<FeedPost, "comments"> & { comments: PostComment[] };

const toPost = (r: z.infer<typeof postRow>, comments: number): FeedPost => ({
  id: r.id,
  body: r.body,
  photoPath: r.photo_path,
  photoUrl: null,
  completionId: r.completion_id,
  createdAt: r.created_at,
  hidden: r.hidden,
  mine: r.mine,
  authorName: r.author_name,
  hearts: r.hearts,
  comments,
  heartedByMe: r.hearted_by_me,
});

/** The feed RPC's JSON; a malformed row is dropped rather than breaking the page. */
export function parseFeed(json: unknown): FeedPost[] {
  if (!Array.isArray(json)) return [];
  const out: FeedPost[] = [];
  for (const item of json) {
    const parsed = postRow.extend({ comments: z.number() }).safeParse(item);
    if (parsed.success) out.push(toPost(parsed.data, parsed.data.comments));
  }
  return out;
}

export function parsePost(json: unknown): PostDetail | null {
  const parsed = postRow.extend({ comments: z.array(commentRow) }).safeParse(json);
  if (!parsed.success) return null;
  const { comments, ...rest } = parsed.data;
  return {
    ...toPost(rest, comments.length),
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      mine: c.mine,
      authorName: c.author_name,
    })),
  };
}
