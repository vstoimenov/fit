# Fit platform redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the client app and landing into an app-like, premium monochrome + powder-pink look (mobile bottom tabs, desktop sidebar), and add a „Сподели" share card after a workout.

**Architecture:** Tailwind 4 `@theme` tokens are redefined (old token names aliased to the new palette, so admin inherits the look for free); a small set of UI primitives (button, chip, card, stat tile, icon) carries the rules; each screen is then rebuilt on them. Data, auth, payment and RLS logic are untouched — presentation only, plus one read-only share route.

**Tech Stack:** Next.js 16 App Router (`cacheComponents: true`), Tailwind 4, `motion`, `next/font` (Manrope), `next/og` (share image), `lucide-react` (icons, new dependency), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-fit-platform-redesign-design.md`

## Global Constraints

- Branch `redesign` (off `plan-1c`). No migrations, no changes to RLS, payments, auth, server data rules; server actions may only gain extra *returned* presentation data.
- Repo `/Users/macbookpro/Downloads/cloude-c/fit-platform`; shell `export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg`; local Supabase containers `*_fit-platform` only (never `supabase_db_adsnap`); dev server via launch config `fit-platform-dev` (port 3120).
- Next 16 page pattern: sync export → `<Suspense>` → async inner with `await connection()`; env read only in `app/**`.
- Palette (exact): ink `#111111`, white `#FFFFFF`, sand `#F4F3F0`, powder `#E5A9AE`, powder-light `#FBEFEF`, powder-chip `#F4D6D6`, rose-deep `#7A3B45`. Powder is never a text colour; text on powder/powder-light/powder-chip is rose-deep.
- Font: Manrope only, weights 400/600/800; Unbounded removed. Type scale (mobile): display 34px/1.05 (−0.02em), screen title 22px/1.15, card title 16px, body 15–16px/1.6, small 12px.
- Buttons: primary = ink pill (max one per screen), secondary = 1.5px ink outline pill, link = underlined text; min touch target 44px. Cards: sand, 16px radius, no shadows, no gradients. Chips are pills.
- Motion only via `motion`, short and soft, disabled under `prefers-reduced-motion`.
- Icons: `lucide-react` only, outline, 20–24px; icon-only buttons have `aria-label`.
- Photos from `public/photos/` via `next/image`, credited in `public/photos/CREDITS.md`. Workout covers never use provider thumbnails (they carry the video id).
- Share image never contains weight, measurements, goals, problems or any questionnaire/health data.
- Light theme only. UI copy Bulgarian, code/commits English; commits end with a blank line + `Co-Authored-By:` trailer naming the model.
- All existing suites stay green: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Review Focus

1. Long Bulgarian strings at 320–375px (nav labels, long workout titles, plan names) → wrap or truncate, never horizontal scroll. Pinned by the 320px browser check in Tasks 2, 3, 4, 8.
2. Workout with no matching photo / unknown focus → falls back to a default cover photo, never a broken image. Pinned by `coverPhoto` tests (Task 1).
3. Share on a browser without `navigator.share`/`canShare({files})` (desktop Firefox, in-app browsers) → download + copy text fallback, never a dead button. Pinned by `pickShareMode` tests (Task 5).
4. Share image URL for someone else's or a non-existent completion id → 404 with no data. Pinned by the `getShareCard` DB test (Task 5).
5. Reduced-motion users → no transitions/celebration animation. Pinned by `transitionFor` tests (Task 1).

---

### Task 1: Tokens, fonts, primitives, photo registry (controller pre-step: assets)

**Controller pre-step (not the implementer):** curate ~12 commercial-use photos (Unsplash/Pexels) of women 25–40 training at home in warm natural light, save as optimised JPG/WebP ≤300 KB into `public/photos/` with names `hero.jpg`, `step-1.jpg`, `step-2.jpg`, `step-3.jpg`, `welcome.jpg`, `focus-full_body.jpg`, `focus-core.jpg`, `focus-glutes_legs.jpg`, `focus-upper.jpg`, `focus-stretch.jpg`, `focus-cardio.jpg`, `default.jpg`; write `public/photos/CREDITS.md` (file, source URL, author, licence). Save Manrope TTF (400, 800) from Google Fonts to `public/fonts/` for `next/og`.

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/button.tsx`, `src/components/ui/field.tsx`, `package.json`
- Create: `src/components/ui/chip.tsx`, `src/components/ui/card.tsx`, `src/components/ui/stat-tile.tsx`, `src/lib/photos.ts`, `src/lib/motion.ts`
- Test: `src/lib/photos.test.ts`, `src/lib/motion.test.ts`

**Interfaces:**
- Produces:
  - Tailwind colours `ink`, `white`, `sand`, `powder`, `powder-light`, `powder-chip`, `rose-deep`, `ink-soft` (`#5C5A55`), `line` (`#E6E4DF`); keep `moss`, `mustard`, `brick` as status colours; aliases so existing classes keep working: `paper` → `#FFFFFF`, `ember` → `#111111`, `ember-deep` → `#7A3B45`. `--font-display` and `--font-sans` both → Manrope.
  - `buttonClass(variant: "primary" | "secondary" | "link" | "quiet" | "ghost", size?: "md" | "lg"): string` — keep existing variant names working (`quiet`/`ghost` map to secondary/link styles) so untouched callers compile.
  - `<Chip tone?: "neutral" | "powder" | "ink">`, `<Card className?>`, `<StatTile label: string value: string progress?: number /* 0..1 */>`.
  - `coverPhoto(focus: string | null | undefined): { src: string; alt: string }` in `src/lib/photos.ts`; `PHOTOS` record for `hero`, `step1..3`, `welcome`.
  - `transitionFor(reduced: boolean, kind: "page" | "pop"): Transition` in `src/lib/motion.ts` (returns `{ duration: 0 }` when reduced).

- [ ] **Step 1: Failing tests**
  - `photos.test.ts`: `coverPhoto("core").src === "/photos/focus-core.jpg"`; `coverPhoto("unknown").src === "/photos/default.jpg"`; `coverPhoto(null).src === "/photos/default.jpg"`; every `FOCUS` value from `@/lib/labels` maps to `/photos/focus-<value>.jpg`; every alt is non-empty Bulgarian text.
  - `motion.test.ts`: `transitionFor(true, "page")` equals `{ duration: 0 }`; `transitionFor(false, "page").duration` between 0.15 and 0.35; `transitionFor(false, "pop")` has `type: "spring"`.
- [ ] **Step 2:** `pnpm vitest run src/lib/photos.test.ts src/lib/motion.test.ts` → FAIL (modules missing).
- [ ] **Step 3:** Implement tokens, remove Unbounded from `layout.tsx` (Manrope 400/600/800 only), `pnpm add lucide-react`, primitives and helpers. `field.tsx`: 48px inputs, sand fill, ink focus ring.
- [ ] **Step 4:** Tests PASS; `pnpm typecheck && pnpm lint && pnpm build`.
- [ ] **Step 5:** Browser: `/admin` (aal2 or test-mode admin) and `/app` render with the new palette and no Unbounded anywhere (`document.fonts` / computed `font-family` contains Manrope). Commit `feat(ui): powder-pink tokens, Manrope only, UI primitives, photo registry`.

### Task 2: App shell — bottom tabs on mobile, sidebar on desktop, Прогрес route

**Files:**
- Create: `src/lib/app-nav.ts`, `src/lib/app-nav.test.ts`, `src/components/app/sidebar-nav.tsx`, `src/app/app/progress/page.tsx`
- Modify: `src/components/app/bottom-nav.tsx`, `src/app/app/layout.tsx`, `src/app/app/profile/page.tsx` (move the sparklines + recent check-ins to Прогрес)

**Interfaces:**
- Produces:
  - `APP_NAV: readonly { href: "/app" | "/app/library" | "/app/progress" | "/app/profile"; label: "Днес" | "Тренировки" | "Прогрес" | "Профил" }[]` (this order).
  - `activeNavHref(pathname: string): string | null`; `navHidden(pathname: string): boolean`.

- [ ] **Step 1: Failing tests** (`app-nav.test.ts`): `activeNavHref("/app") === "/app"`; `"/app/library"` and `"/app/library/x"` → `"/app/library"`; `"/app/progress"` and `"/app/check-in"` → `"/app/progress"`; `"/app/profile"` and `"/app/plan"` → `"/app/profile"`; `"/app/welcome"` → `null`; `navHidden("/app/workout/abc") === true`; `navHidden("/app") === false`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement. Layout: below `lg` the content column is `max-w-md` with the bottom tab bar (lucide icons Home, Dumbbell, LineChart, User; active = rose-deep label + powder icon); from `lg` a 240px left sidebar (placeholder name from `brand.name`, the same 4 items, active = powder-chip background + rose-deep text) and a content column `max-w-5xl`. The workout route hides both. Past-due banner restyled (brick status, secondary button „Обнови картата"). `/app/progress`: sparklines (weight, waist) as cards + recent check-ins list + primary link „Отбележи седмицата" → `/app/check-in`; profile keeps only personal data, subscription and account actions.
- [ ] **Step 4:** Tests PASS; full checks.
- [ ] **Step 5:** Browser at 320, 375 and 1280 wide: tabs visible on mobile, sidebar on desktop, no horizontal scroll, active state correct on each route. Commit `feat(app): app shell with bottom tabs, desktop sidebar, progress tab`.

### Task 3: Днес

**Files:** Modify `src/app/app/page.tsx`, `src/components/today/week-strip.tsx`, `src/components/today/countdown.tsx`, `src/components/workout/workout-cover.tsx`

**Interfaces:**
- Consumes: `getTodayView` (unchanged), `coverPhoto`, `StatTile`, `Chip`, `buttonClass` (Task 1).
- Produces: `<WorkoutCover focus: string | null; title: string; className?>` — photo cover via `coverPhoto(focus)` with a dark bottom scrim for the title (no gradient: a solid `bg-ink/40` band); old `level`/`kind` props removed and callers updated.

- [ ] **Step 1:** Rebuild Днес: greeting + date (small), screen title, large photo card with level chip (powder) and duration chip (neutral), primary „Започни", week strip (done days powder with white letter, today ink outline), stat tiles „Тази седмица x/5" (with progress) and „Поредица N дни". Locked, no-access, rest-day and countdown states keep their logic and copy, restyled. Desktop: hero card left, tiles right (grid).
- [ ] **Step 2:** Full checks green.
- [ ] **Step 3:** Browser at 320/375/1280 with the seeded member in each state you can reach (access, no access, past_due banner). Commit `feat(app): today screen redesign`.

### Task 4: Тренировки, workout page, player and after-workout screen

**Files:** Modify `src/app/app/library/page.tsx`, `src/components/workout/workout-card.tsx`, `src/app/app/workout/[id]/page.tsx`, `src/components/workout/player.tsx`; Create `src/components/workout/after-workout.tsx`

**Interfaces:**
- Consumes: `WorkoutCover` (Task 3), `transitionFor` (Task 1), `ShareButton` (Task 5 — leave a clearly marked slot `{/* share */}` in `after-workout.tsx`; Task 5 fills it).
- Produces: `<AfterWorkout streakDays: number; weekDone: number; weekTarget: number; first: boolean; onRate(feeling: keyof typeof FEELING_LABEL): void; completionId: string />`.

- [ ] **Step 1:** Library: image-led cards (cover, title, level + duration chips), filter chips as pills (existing `filterLibrary`/`parseLibraryFilter` untouched); desktop grid 2–3 columns.
- [ ] **Step 2:** Workout page/player: video on top full-width, title, chips (level, duration, equipment if present), description, primary „Завърших тренировката" (existing unlock rule and copy for the locked state kept).
- [ ] **Step 3:** After completion show `AfterWorkout`: powder-light circle with a Flame icon (pop animation via `transitionFor`), „Браво, {name}!" (or „Браво!" without a name), „{streak} дни поред · {done} от {target} тази седмица", „Как беше?" chips (existing `rateWorkout`), share slot, then primary „Към днес" — or „Виж плановете" → `/app/plan?after=first` for the first free workout (existing routing). Extend `completeWorkout` to also return `{ streakDays, weekDone, weekTarget }` computed from the same source as Днес (`getTodayView` or the helpers it uses) — read-only.
- [ ] **Step 4:** Full checks green (update any test of `completeWorkout` for the extra fields).
- [ ] **Step 5:** Browser: complete a workout locally end to end at 375 and 1280; reduced-motion emulation shows no animation. Commit `feat(app): library, workout and after-workout redesign`.

### Task 5: Share card

**Files:**
- Create: `src/lib/share/share-card.ts`, `src/lib/share/share-card.test.ts`, `src/lib/share/share-mode.ts`, `src/lib/share/share-mode.test.ts`, `src/server/content/share.ts`, `supabase/tests/share-card.test.ts`, `src/app/api/share/[completionId]/route.tsx`, `src/components/workout/share-button.tsx`
- Modify: `src/components/workout/after-workout.tsx` (fill the share slot)

**Interfaces:**
- Produces:
  - `interface ShareCard { workoutTitle: string; streakDays: number; weekDone: number; weekTarget: number }`
  - `toShareCard(input: Record<string, unknown>): ShareCard` — copies only those four keys; title trimmed to 60 chars (ellipsis), numbers floored and clamped (`streakDays` ≥ 0, `weekTarget` 1..7, `weekDone` 0..weekTarget).
  - `shareText(card: ShareCard): string` → exactly `"{title} · {streak} дни поред · {done}/{target} тази седмица"`; when streak is 1 → `"1 ден поред"`.
  - `type ShareMode = "files" | "text" | "download"`; `pickShareMode(nav: { share?: unknown; canShare?: (data: { files: File[] }) => boolean }, file: File): ShareMode`.
  - `getShareCard(db: TypedClient, userId: string, completionId: string): Promise<ShareCard | null>` (user-session client; RLS limits to own rows).
  - `GET /api/share/[completionId]?format=story|square` → PNG 1080×1920 (story, default) or 1080×1080 (square); 401 without session, 404 when `getShareCard` is null; `Cache-Control: private, no-store`.

- [ ] **Step 1: Failing tests**
  - `share-card.test.ts`: input with extra keys `weight_kg`, `waist_cm`, `goal`, `problems`, `height_cm` → result `Object.keys` equals exactly the four keys; 80-char title → length ≤ 60 ending with „…"; `weekTarget: 0` → 1, `weekDone: 9, weekTarget: 5` → 5, `streakDays: -3` → 0; `shareText` for streak 4 / 3 of 5 equals `"Цяло тяло · 4 дни поред · 3/5 тази седмица"`, streak 1 uses „1 ден поред".
  - `share-mode.test.ts`: `canShare` true → `"files"`; `share` present but `canShare` false/missing → `"text"`; no `share` → `"download"`.
  - `supabase/tests/share-card.test.ts`: member A's completion → card with her workout title and four keys only; member B asking for A's completion id → `null`; random uuid → `null`.
- [ ] **Step 2:** run each → FAIL.
- [ ] **Step 3:** Implement. The route renders with `ImageResponse` from `next/og`, Manrope TTFs from `public/fonts/`, palette: white background, ink headline (workout title), powder streak number, sand tile for the week, placeholder name `brand.name` + landing URL small at the bottom. `ShareButton` (secondary „Сподели"): fetches the story PNG as a `File`, `pickShareMode` → `navigator.share({ files, text, url })` / `navigator.share({ text, url })` / download link + `navigator.clipboard.writeText(text)` with a „Копирано" confirmation; user-cancelled share (`AbortError`) is silent. A disabled-for-now community slot is NOT rendered (spec: appears only when community exists) — leave a comment where it will go.
- [ ] **Step 4:** Tests PASS; full checks.
- [ ] **Step 5:** Browser: after-workout „Сподели" at 375 (mobile emulation) and 1280 (download fallback); open `/api/share/<id>` for own id (image) and a random uuid (404). Commit `feat(share): share card image and share button after a workout`.

### Task 6: Onboarding questionnaire, finish and login

**Files:** Modify `src/components/onboarding/wizard.tsx`, `src/components/onboarding/steps.tsx`, `src/app/start/page.tsx`, `src/app/start/finish/page.tsx`, `src/app/login/page.tsx`, `src/app/forgot-password/*`, `src/app/reset-password/*`

- [ ] **Step 1:** Wizard: one question per screen; top bar = back arrow (ChevronLeft, `aria-label="Назад"`), powder progress bar, „n/N"; big option cards (`ChoiceList`: 1.5px line border, selected = ink border + powder-light fill + check icon); primary „Напред" pinned at the bottom of the viewport on mobile; step transitions via `transitionFor("page")`. Validation, storage (`storage.ts`) and step order unchanged; existing `storage.test.ts` stays green.
- [ ] **Step 2:** Finish/login/password pages: single short card, 48px fields, one primary button, secondary links; Google button only when enabled (existing flag).
- [ ] **Step 3:** Full checks green; browser through the whole questionnaire at 320/375/1280 (keyboard: Enter advances, focus moves to the new question heading). Commit `feat(onboarding): one-question screens and auth pages redesign`.

### Task 7: Plans, welcome, profile, check-in

**Files:** Modify `src/app/app/plan/page.tsx`, `src/app/app/plan/plan-picker.tsx`, `src/app/app/welcome/*`, `src/app/app/profile/page.tsx`, `src/app/app/check-in/page.tsx`

- [ ] **Step 1:** Plans: two cards (monthly, yearly), yearly with a powder-chip badge „Най-изгодно" and the per-month equivalent; selected card = ink border; existing payable/„Скоро"/card-update states and copy kept; primary button = existing subscribe action.
- [ ] **Step 2:** Welcome: `PHOTOS.welcome` hero, „Добре дошла", existing polling/redirect logic. Profile: grouped cards (Лични данни, Абонамент with existing manage button and notices, Акаунт: export / delete with existing confirmations). Check-in: card form, 48px fields, primary „Запази".
- [ ] **Step 3:** Full checks green; browser at 375/1280 for each page and state you can reach locally. Commit `feat(app): plans, welcome, profile and check-in redesign`.

### Task 8: Landing

**Files:** Modify `src/app/page.tsx`; Create `src/components/landing/{hero,how-it-works,included,pricing,faq,site-footer}.tsx`

- [ ] **Step 1:** Sections in order: hero (`PHOTOS.hero`, display headline from `brand.tagline`, sub-line, primary „Започни безплатно" → `/start`, secondary „Имам профил" → `/login`); „Как работи" 3 steps (`PHOTOS.step1..3`: Отговори на N въпроса — N = the wizard's real question count → Направи първата тренировка безплатно → Тренирай по своя програма); „Какво получаваш" (weekly program by level, library, progress tracking, notifications); price (active plans read with the anon server client inside a `"use cache"` function with `cacheLife("hours")`; if anon cannot read plans, render the section without amounts); FAQ (5 items, native `<details>`); footer with links to legal pages if they exist, otherwise plain text placeholders. Testimonials are omitted until real ones exist (no fake reviews). Keep `DeletedNotice`.
- [ ] **Step 2:** Full checks green; browser at 320/375/1280: no horizontal scroll, one primary button per section, images have alt text. Commit `feat(landing): landing page redesign`.

### Task 9: Verification, screenshots, docs

**Files:** Create `docs/screenshots/redesign/*.png`; Modify `README.md` (design tokens + photo credits pointer), `docs/superpowers/plans/2026-10-14-fit-platform-1a-followups.md` (tick design pass items; add „replace stock photos with own", „dark mode", „community share slot")

- [ ] **Step 1:** `pnpm typecheck && pnpm lint && pnpm test && pnpm db:reset && pnpm test:db && pnpm build` — quote tails in the report.
- [ ] **Step 2:** Screenshots (375×812 and 1280×800) of: landing, questionnaire step, Днес, Тренировки, workout, after-workout, Прогрес, Профил, plans, admin dashboard (token inheritance). Contrast spot-check (rose-deep on powder-chip, ink-soft on white ≥ 4.5:1).
- [ ] **Step 3:** Commit `docs: redesign screenshots and notes`. (Deploy to Vercel is done by the controller.)
