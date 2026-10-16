import Image from "next/image";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { formatArticleDate } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/labels";
import type { ArticleSummary } from "@/server/content/articles";

/** Cover images: `/photos/…` is optimised locally; owner-supplied https URLs are served as-is. */
export function ArticleCover({
  src,
  sizes,
  className,
  preload = false,
}: {
  src: string;
  sizes: string;
  className: string;
  preload?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        preload={preload}
        unoptimized={!src.startsWith("/")}
        className="object-cover"
      />
    </div>
  );
}

/** List card: optional cover, title, excerpt, date and a level chip when the article is targeted. */
export function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/app/learn/${article.slug}`}
      className="block overflow-hidden rounded-2xl bg-sand active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {article.cover_url && (
        <ArticleCover
          src={article.cover_url}
          sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
          className="h-44"
        />
      )}
      <div className="space-y-2 p-4">
        <p className="text-base font-extrabold leading-snug">{article.title}</p>
        {article.excerpt && (
          <p className="text-sm leading-relaxed text-ink-soft">{article.excerpt}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {article.published_at && (
            <span className="text-xs font-semibold text-ink-soft">
              {formatArticleDate(new Date(article.published_at))}
            </span>
          )}
          {article.level && <Chip tone="powder">{LEVEL_LABEL[article.level]}</Chip>}
        </div>
      </div>
    </Link>
  );
}
