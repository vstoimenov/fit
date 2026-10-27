import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { CommentForm } from "@/components/community/comment-form";
import { Avatar, PostCard } from "@/components/community/post-card";
import { PostMenu } from "@/components/community/post-menu";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/community/format";
import { requireUser } from "@/server/auth/require-user";
import { getPost } from "@/server/community/feed";

export const metadata = { title: "Публикация" };

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Post params={params} />
    </Suspense>
  );
}

async function Post({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data: hasAccess } = await supabase.rpc("my_access");
  if (!hasAccess) notFound();
  const post = await getPost(supabase, id);
  if (!post) notFound();

  return (
    <main className="space-y-5 px-5 pb-6 pt-6 lg:mx-auto lg:max-w-2xl lg:px-8">
      <Link
        href="/app/community"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        Общност
      </Link>
      <PostCard post={{ ...post, comments: post.comments.length }} detail />
      <section aria-labelledby="comments-heading" className="space-y-3">
        <h2 id="comments-heading" className="text-xl font-extrabold tracking-tight">
          Коментари
        </h2>
        {post.comments.length === 0 ? (
          <Card className="p-4 text-ink-soft">Още няма коментари.</Card>
        ) : (
          <ul className="space-y-3">
            {post.comments.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-line"
              >
                <Avatar name={c.authorName} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-extrabold">{c.authorName}</span>{" "}
                    <time dateTime={c.createdAt} className="text-xs text-ink-soft">
                      {relativeTime(c.createdAt)}
                    </time>
                  </p>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{c.body}</p>
                </div>
                <PostMenu target={{ commentId: c.id }} mine={c.mine} postId={post.id} />
              </li>
            ))}
          </ul>
        )}
        <CommentForm postId={post.id} />
      </section>
    </main>
  );
}
