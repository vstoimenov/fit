import { z } from "zod";
import { AppError } from "@/lib/app-error";
import type { Level } from "@/lib/program/types";
import type { TypedClient } from "@/server/db/types";

const SLUG = /^[a-z0-9-]{3,80}$/;

export const articleInputSchema = z.object({
  title: z.string().trim().min(1, "Нужно е заглавие").max(120, "До 120 знака"),
  slug: z
    .string()
    .trim()
    .regex(SLUG, "Адресът е 3–80 знака: малки латински букви, цифри и тирета."),
  excerpt: z.string().trim().max(300, "Кратко описание до 300 знака").default(""),
  body: z.string().trim().min(1, "Нужен е текст").max(50_000, "Текстът е прекалено дълъг"),
  coverUrl: z.union(
    [
      z.literal(""),
      z
        .string()
        .trim()
        .max(500)
        .regex(/^(https:\/\/\S+|\/photos\/\S+)$/),
    ],
    "Корицата е https:// линк или /photos/…",
  ),
  level: z.union([z.literal(""), z.enum(["beginner", "advanced", "pro"])], "Невалидно ниво"),
  membersOnly: z.boolean(),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  level: Level | null;
  membersOnly: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AdminArticle extends ArticleListItem {
  excerpt: string;
  body: string;
  coverUrl: string | null;
}

const LIST_COLUMNS = "id, slug, title, level, members_only, published_at, updated_at";
const COLUMNS = `${LIST_COLUMNS}, excerpt, body, cover_url`;

type ListRow = {
  id: string;
  slug: string;
  title: string;
  level: Level | null;
  members_only: boolean;
  published_at: string | null;
  updated_at: string;
};
type Row = ListRow & { excerpt: string; body: string; cover_url: string | null };

const toListItem = (r: ListRow): ArticleListItem => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  level: r.level,
  membersOnly: r.members_only,
  publishedAt: r.published_at,
  updatedAt: r.updated_at,
});

const NOT_FOUND = "Статията не е намерена.";
const FORBIDDEN = "Нямаш достъп.";

type WriteError = { code?: string; message?: string };

function throwWriteError(error: WriteError, what: string): never {
  if (error.code === "23505") {
    throw new AppError("CONFLICT", "Има статия с този адрес (slug).");
  }
  if (error.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
  throw new Error(`${what} failed: ${error.message}`);
}

/** Drafts first, then published newest first. The body is left out: a list does not need it. */
export async function listArticles(db: TypedClient): Promise<ArticleListItem[]> {
  const { data, error } = await db
    .from("articles")
    .select(LIST_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`list articles failed: ${error.message}`);
  return (data as ListRow[]).map(toListItem);
}

export async function getArticle(db: TypedClient, id: string): Promise<AdminArticle | null> {
  const { data, error } = await db.from("articles").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`load article failed: ${error.message}`);
  if (!data) return null;
  const r = data as Row;
  return { ...toListItem(r), excerpt: r.excerpt, body: r.body, coverUrl: r.cover_url };
}

/** Creates (id null) or updates an article; publication is a separate step (`setPublished`). */
export async function saveArticle(
  db: TypedClient,
  id: string | null,
  raw: unknown,
): Promise<{ id: string }> {
  const a = articleInputSchema.parse(raw);
  const fields = {
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    body: a.body,
    cover_url: a.coverUrl === "" ? null : a.coverUrl,
    level: a.level === "" ? null : a.level,
    members_only: a.membersOnly,
  };
  if (id === null) {
    const { data, error } = await db.from("articles").insert(fields).select("id").single();
    if (error) throwWriteError(error, "create article");
    return { id: data.id };
  }
  const { data, error } = await db.from("articles").update(fields).eq("id", id).select("id");
  if (error) throwWriteError(error, "update article");
  if (data.length === 0) throw new AppError("NOT_FOUND", NOT_FOUND);
  return { id };
}

export async function setPublished(db: TypedClient, id: string, published: boolean): Promise<void> {
  const { data, error } = await db
    .from("articles")
    .update({ published_at: published ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) throwWriteError(error, "publish article");
  if (data.length === 0) throw new AppError("NOT_FOUND", NOT_FOUND);
}

export async function deleteArticle(db: TypedClient, id: string): Promise<void> {
  const { data, error } = await db.from("articles").delete().eq("id", id).select("id");
  if (error) throwWriteError(error, "delete article");
  if (data.length === 0) throw new AppError("NOT_FOUND", NOT_FOUND);
}
