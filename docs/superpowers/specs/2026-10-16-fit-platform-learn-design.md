# Fit platform — level-only library, „Полезно" tab (articles + community slot)

Date: 2026-10-16. Status: owner opted out of questions („направи го"); choices below are the controller's calls, stated for review.

## Why

After seeing the live redesign the owner asked for two things: a beginner must see only beginner workouts, and the
app needs a place for the community and for useful articles. Articles content will come from the owner later; the
community itself (Skool-like) is still stage 7 — for now the slot links to an external group when one exists.

## 1. Library shows only the member's level

- `/app/library` lists regular workouts whose `level` equals the member's `profiles.level`; the level filter chips go
  away. Duration and focus chips stay.
- A quiet line under the title: „Показваме тренировки за ниво {Начинаещ}. Можеш да го смениш в профила." with a link to
  `/app/profile` (the profile already lets her change her level).
- Starter-week / intro workouts and „Днес" keep their current logic (already level-aware).
- Old links with `?level=…` are ignored (no error).

## 2. „Полезно" — fifth tab

Navigation becomes **Днес · Тренировки · Прогрес · Полезно · Профил** (mobile bottom bar and desktop sidebar; icon
BookOpen). Route `/app/learn`.

### Articles (owner-authored, Markdown)

- Table `public.articles`: `id uuid pk`, `slug text unique` (`^[a-z0-9-]{3,80}$`), `title` (1–120), `excerpt` (≤ 300,
  optional), `body` Markdown (≤ 50 000), `cover_url` (optional; `https://…` or a `/photos/…` path, ≤ 500),
  `level public.workout_level null` (null = all levels), `members_only boolean default false`, `published_at
  timestamptz null`, `created_at`, `updated_at`; `set_updated_at` trigger; audit trigger `audit_row('id')`.
- RLS (authenticated): select when `is_admin()` OR (`published_at` not null and `≤ now()` AND (`not members_only` OR
  `my_access()`)); insert/update/delete only `is_admin()`. Grants as the other admin tables; nothing for `anon`.
- Admin: `/admin/articles` (list: title, status Чернова/Публикувана, date, level), `/admin/articles/new`,
  `/admin/articles/[id]` — form with title, slug (prefilled by a Cyrillic→Latin `slugify`, editable), excerpt, body
  (Markdown textarea with a short syntax hint), cover URL, level (Всички/Начинаещ/Напреднал/Профи), „Само за абонати",
  publish / unpublish, delete (with confirm). Admin nav gets „Статии".
- Member: `/app/learn` lists published articles for her level (level null or equal), newest first: cover (or no
  image), title, excerpt, date, level chip when targeted. `/app/learn/[slug]` renders the article: title, date,
  cover, body via `react-markdown` (HTML in the source is never rendered as HTML), styled headings/lists/links/quotes.
  Members-only articles simply don't appear for members without access (RLS); no teaser.
- Empty state (no articles yet): „Скоро тук ще има статии от нас." — a card, no broken layout.

### Community slot

- Settings key `community_url` (admin Настройки → „Общност": https URL or empty). Exposed to members through a
  security-definer function `public.community_link()` (returns text or null; `settings` stays admin-only).
- On `/app/learn`, above the articles: a card „Общност". With a URL: one line + secondary button „Влез в общността"
  (opens the external link in a new tab, `rel="noopener noreferrer"`). Without: „Общността идва скоро — място, където ще
  споделяме прогрес и ще се подкрепяме." No fake member counts.

## Constraints

- Presentation rules from the redesign spec (tokens, Manrope, one primary per screen, 44px targets, lucide, Bulgarian
  copy, no shadows/gradients). Next 16 cacheComponents pattern; env only in `app/**`; services testable without
  `src/env.ts`.
- New migration only (never edit applied ones); `pnpm db:reset && pnpm db:types`. The controller applies the migration
  to the hosted project afterwards.
- Markdown rendering must not execute or render raw HTML; external links in articles open safely.
- Landing copy does not advertise articles/community until real content exists.

## Testing / acceptance

- DB tests: RLS matrix (draft/published/future-dated; members_only with and without access; level targeting is a query
  concern, not RLS; member cannot write); `community_link()` null / empty / set; slug and length checks.
- Unit: `slugify` (Cyrillic, spaces, punctuation, length cap), library filter ignores `level`, nav helpers for the 5th
  tab, Markdown safety (a body containing `<script>` renders no `<script>` element; links get `rel="noopener"`).
- Browser: 5 tabs at 375 and 1280 without overflow; library of a beginner shows only beginner workouts; admin creates,
  publishes and reads an article; community card in both states.
- Existing suites stay green.

## Out of scope

The Skool-like community itself, comments/likes on articles, article images upload (URL only for now), notifications
about new articles, landing changes.
