import { MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { relativeTime } from "@/lib/community/format";
import type { FeedPost } from "@/server/community/parse";
import { HeartButton } from "./heart-button";
import { PostMenu } from "./post-menu";

/** The author's initials on a powder circle — no avatars in the club. */
export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-powder-chip text-sm font-extrabold text-rose-deep"
    >
      {initials}
    </span>
  );
}

/** One post in the feed (server component; the heart and the menu are client islands). */
export function PostCard({ post, detail = false }: { post: FeedPost; detail?: boolean }) {
  return (
    <article className="space-y-3 rounded-2xl bg-sand p-4">
      <header className="flex items-start gap-3">
        <Avatar name={post.authorName} />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">{post.authorName}</p>
          <p className="text-xs text-ink-soft">
            <time dateTime={post.createdAt}>{relativeTime(post.createdAt)}</time>
            {post.hidden && " · скрита от екипа"}
          </p>
        </div>
        <PostMenu target={{ postId: post.id }} mine={post.mine} postId={post.id} />
      </header>
      <p className="whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>
      {post.photoUrl && (
        <Image
          src={post.photoUrl}
          alt=""
          width={800}
          height={800}
          unoptimized
          className="max-h-[480px] w-full rounded-xl object-cover"
        />
      )}
      {post.hidden ? (
        <p className="text-sm text-ink-soft">Скрита е от екипа — другите не я виждат.</p>
      ) : (
        <footer className="flex items-center gap-1">
          <HeartButton postId={post.id} hearts={post.hearts} hearted={post.heartedByMe} />
          {detail ? (
            <span className="inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-ink-soft">
              <MessageCircle size={20} strokeWidth={2.25} aria-hidden="true" />
              <span className="tabular-nums">{post.comments}</span>
            </span>
          ) : (
            <Link
              href={`/app/community/${post.id}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <MessageCircle size={20} strokeWidth={2.25} aria-hidden="true" />
              <span className="tabular-nums">{post.comments}</span>
              <span className="sr-only"> коментара</span>
            </Link>
          )}
        </footer>
      )}
    </article>
  );
}
