# Level-only library + „Полезно" tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The library shows only the member's level, and a fifth tab „Полезно" offers owner-written Markdown articles plus a community slot (external link or „скоро").

**Architecture:** One migration adds `articles` (RLS: published + members_only via `my_access()`, admin writes) and a security-definer `community_link()` over the admin-only `settings`. Admin CRUD follows the workouts pages; member pages follow the redesign primitives; `react-markdown` renders bodies without raw HTML.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`), Supabase (RLS, security definer), zod 4, Tailwind 4, `react-markdown` (new), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-fit-platform-learn-design.md`

## Global Constraints

- Repo `/Users/macbookpro/Downloads/cloude-c/fit-platform`, branch `learn` (off `main`). Shell `export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg`; local Supabase containers `*_fit-platform` only; `pnpm db:reset && pnpm db:types` after the migration; never edit applied migrations.
- Next 16 page pattern: sync export → `<Suspense>` → async inner with `await connection()`; `params`/`searchParams` are Promises; env read only in `app/**`; services under `src/server/**` and `src/lib/**` never import `src/env.ts`.
- Admin code uses the admin's session (RLS + audit); `is_admin()` semantics unchanged.
- Design rules from the redesign: tokens (ink/white/sand/powder/powder-light/powder-chip/rose-deep), Manrope, one primary (ink pill) per screen, 44px targets, lucide icons, cards sand/16px, no shadows/gradients, Bulgarian copy; primitives in `src/components/ui/`; `cn()` merges classes.
- Markdown: `react-markdown` with default settings (no `rehype-raw`); links rendered with `target="_blank" rel="noopener noreferrer"` for external hrefs; images allowed only from `https://` or `/photos/`.
- Copy: nav labels exactly „Днес", „Тренировки", „Прогрес", „Полезно", „Профил"; library note „Показваме тренировки за ниво {LEVEL_LABEL}. Можеш да го смениш в профила."; community copy per spec.
- All suites green: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Review Focus

1. A member whose `level` row value is unexpected (null/legacy) → library shows her current level's rows or an empty state, never a crash. Pinned by the library DB test (Task 4).
2. Article body with raw HTML / `javascript:` links → rendered as text / link neutralised. Pinned by the Markdown safety unit test (Task 3).
3. `members_only` article and a member whose access just lapsed → disappears from the list and the detail 404s (RLS), no cached leak. Pinned by the RLS DB test (Task 1) and the detail page using the user session (Task 3).
4. Duplicate slug on save → friendly CONFLICT message, not a 500. Pinned by the admin service test (Task 2).
5. `community_url` set to a non-https value → refused on save; `community_link()` never returns it. Pinned by the settings test (Task 1/2).

---

### Task 1: Migration — articles table, RLS, `community_link()`, settings key

**Files:**
- Create: `supabase/migrations/20261018100000_articles.sql`, `supabase/tests/articles-db.test.ts`
- Modify: `src/server/admin/settings.ts` (settings key whitelist + zod), `src/lib/supabase/database.types.ts` (regenerated)

**Interfaces:**
- Produces: table `public.articles` as in the spec; `public.community_link() returns text` (security definer, `search_path=''`, execute granted to `authenticated`, revoked from `public, anon`): returns `nullif(btrim(value #>> '{}'), '')` of settings key `community_url` when it starts with `https://`, else null. `saveSetting(db, "community_url", value)` accepts `""` or an `https://` URL ≤ 300 chars (zod), stores the string as jsonb; `getSettings` exposes `community_url: string`.

- [ ] **Step 1: Failing DB tests** (`articles-db.test.ts`, helpers as in `supabase/tests/admin-settings.test.ts` / `access.test.ts`): admin inserts a draft, a published, a future-dated, and a published `members_only` article → a member without access sees only the published non-members-only one; after a manual grant (`grantAccess`) she also sees the members-only one; member insert/update/delete are refused (RLS error or 0 rows); slug `"Ab"` and a 50 001-char body are rejected by CHECKs; `community_link()` → null by default, null for `""` and for `http://x`, the URL for `https://t.me/grupa`; non-admin `saveSetting("community_url", "http://x")` is refused by zod and the admin one with `"https://…"` round-trips through `getSettings`.
- [ ] **Step 2:** run → FAIL (table/function missing).
- [ ] **Step 3:** Write the migration (table, CHECKs, triggers `set_updated_at` + `articles_audit`, RLS policies, grants, function), extend the settings whitelist, `pnpm db:reset && pnpm db:types`.
- [ ] **Step 4:** Tests PASS; `pnpm test:db` full green; typecheck/lint.
- [ ] **Step 5:** Commit `feat(db): articles table with RLS, community_link(), community_url setting`.

### Task 2: Admin — articles CRUD and community URL setting

**Files:**
- Create: `src/server/admin/articles.ts`, `src/lib/slugify.ts`, `src/lib/slugify.test.ts`, `supabase/tests/admin-articles.test.ts`, `src/app/admin/(panel)/articles/{page.tsx,actions.ts,article-form.tsx,new/page.tsx,[id]/page.tsx}`
- Modify: `src/components/admin/admin-nav.tsx` („Статии" after „Тренировки"), `src/app/admin/(panel)/settings/{page.tsx,forms.tsx,actions.ts}` (field „Линк към общността")

**Interfaces:**
- Produces: `slugify(input: string): string` (Cyrillic→Latin per the common BG transliteration, lowercase, non-alphanumerics → `-`, collapse, trim, max 80, min 3 → pads with `-x` only if shorter); `articleInputSchema` (zod: title 1–120, slug regex, excerpt ≤ 300, body 1–50 000, coverUrl `""`|https|`/photos/…`, level `""`|Level, membersOnly boolean); `listArticles(db)`, `getArticle(db, id)`, `saveArticle(db, id | null, raw) → { id }` (23505 → `AppError("CONFLICT", "Има статия с този адрес (slug).")`), `setPublished(db, id, published: boolean)` (sets `published_at = now()` or null), `deleteArticle(db, id)`.

- [ ] **Step 1: Failing tests:** `slugify.test.ts` („Как да започна" → `kak-da-zapochna`; „Йога & пилатес!" → `yoga-pilates`; 100 chars → length ≤ 80; „ab" → length ≥ 3); `admin-articles.test.ts` (admin create/edit/publish/unpublish/delete round-trip; duplicate slug → CONFLICT; non-admin `saveArticle` refused).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement services, pages (list with status chips, form with Markdown hint and live slug prefill, publish/unpublish/delete via `ActionForm` like workouts), settings field, nav item.
- [ ] **Step 4:** Tests PASS; full checks; browser (local admin with the test-mode flag): create → publish → see it in the list; set the community URL.
- [ ] **Step 5:** Commit `feat(admin): articles CRUD and community link setting`.

### Task 3: Member — „Полезно" tab, article list and detail, community card

**Files:**
- Create: `src/server/content/articles.ts`, `src/app/app/learn/{page.tsx,[slug]/page.tsx}`, `src/components/learn/{article-card.tsx,article-body.tsx,community-card.tsx}`, `src/components/learn/article-body.test.ts`, `supabase/tests/articles-member.test.ts`
- Modify: `src/lib/app-nav.ts` (+ test), `src/components/app/nav-icons.ts` (BookOpen), `package.json` (`react-markdown`)

**Interfaces:**
- Produces: `listArticlesFor(db, level: Level)` (published, `level is null or = level`, newest first; columns `id, slug, title, excerpt, cover_url, level, published_at`), `getArticleBySlug(db, slug)` (full row or null), `getCommunityLink(db)` (rpc `community_link`); `APP_NAV` with the 5th entry `{ href: "/app/learn", label: "Полезно" }` before Профил; `activeNavHref("/app/learn/x") === "/app/learn"`.

- [ ] **Step 1: Failing tests:** `app-nav.test.ts` additions; `article-body.test.ts` renders `ArticleBody` with `react-dom/server` for a body containing `<script>alert(1)</script>`, `[x](javascript:alert(1))`, `[y](https://example.com)` → output has no `<script` element, the javascript link is not an anchor with that href, the https link has `rel="noopener noreferrer"` and `target="_blank"`; `articles-member.test.ts`: beginner sees null-level + beginner articles but not an advanced one; `getArticleBySlug` returns null for a draft.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** `pnpm add react-markdown`; implement pages (list: community card first, then cards; empty state card; detail: back link „Полезно", title, date in Europe/Sofia, cover, body; `notFound()` when null) with the primitives; nav icon.
- [ ] **Step 4:** Tests PASS; full checks; browser at 375/1280: 5 tabs fit, list/detail/empty state, community card both states.
- [ ] **Step 5:** Commit `feat(app): Полезно tab with articles and community card`.

### Task 4: Library shows only the member's level

**Files:**
- Modify: `src/app/app/library/page.tsx`, `src/lib/program/library-filter.ts` (+ test), `src/server/content/workouts.ts` (library query by level) and its DB test

- [ ] **Step 1: Failing tests:** `library-filter.test.ts`: `parseLibraryFilter({ level: "pro" })` has no `level` key; DB test: a beginner's library query returns only beginner regular workouts (seed has all three levels), an advanced member only advanced.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement: query by `profile.level`; remove level chips; add the note line with the profile link; keep duration/focus chips and the locked/no-access presentation.
- [ ] **Step 4:** Tests PASS; full checks; browser as a beginner at 375/1280.
- [ ] **Step 5:** Commit `feat(app): library limited to the member's level`.
