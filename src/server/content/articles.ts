import { SLUG } from "@/lib/articles/slug";
import type { Level } from "@/lib/program/types";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

const LIST_COLUMNS = "id, slug, title, excerpt, cover_url, level, published_at" as const;

type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleSummary = Pick<
  ArticleRow,
  "id" | "slug" | "title" | "excerpt" | "cover_url" | "level" | "published_at"
>;

/**
 * Published articles for a member of `level`: untargeted ones plus those aimed at her level,
 * newest first. RLS already hides drafts, scheduled and members-only articles she can't open;
 * the publish filter is explicit because RLS also lets admins read drafts.
 */
export async function listArticlesFor(db: TypedClient, level: Level): Promise<ArticleSummary[]> {
  const { data, error } = await db
    .from("articles")
    .select(LIST_COLUMNS)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .or(`level.is.null,level.eq.${level}`)
    .order("published_at", { ascending: false });
  if (error) throw new Error(`list articles failed: ${error.message}`);
  return data;
}

/** One article by slug, or null when it doesn't exist or RLS hides it from this viewer. */
export async function getArticleBySlug(db: TypedClient, slug: string): Promise<ArticleRow | null> {
  // A malformed slug can't match a row; skip the query (the page turns null into a 404).
  if (!SLUG.test(slug)) return null;
  const { data, error } = await db
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`load article failed: ${error.message}`);
  return data;
}

/** The community URL set in admin settings, or null when there is none yet. */
export async function getCommunityLink(db: TypedClient): Promise<string | null> {
  const { data, error } = await db.rpc("community_link");
  if (error) throw new Error(`load community link failed: ${error.message}`);
  // The generated type says `string`, but the function returns null when unset.
  return (data as string | null) || null;
}
