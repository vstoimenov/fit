# Progress Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members upload private progress photos, see them in Прогрес/Профил, and share one photo or a „Преди / След“ pair as a 1080×1350 image with an „I AM STRONG“ badge.

**Architecture:** Private Supabase Storage bucket + `progress_photos` table written only through security-definer functions; the browser compresses and uploads with her session, a server action records the row; server components show signed URLs; the share image is drawn on a client canvas and handed to the Web Share sheet (download fallback), reusing `pickShareMode`.

**Tech Stack:** Next.js 16 App Router (cacheComponents), Supabase (Postgres RLS, Storage), TypeScript, Tailwind 4 tokens, Vitest (unit + `supabase/tests` DB tests), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-23-fit-platform-progress-photos-design.md`

## Global Constraints

- Bucket `progress-photos`: private, `file_size_limit` 5242880, `allowed_mime_types` `{image/jpeg}`; object path `{user_id}/{uuid}.jpg`.
- Path regex (SQL and TS must agree): `^<uid>/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$`.
- Max 200 photos per member; `taken_on` ≤ today in Europe/Sofia and ≥ 2000-01-01.
- Upload: long side ≤ 1600 px, JPEG quality 0.85. Share image: 1080×1350; before/after halves 540×1350 with a 6 px white divider.
- Signed URLs: 3600 s. Share file name `progres.jpg`; share text „Моят прогрес с I AM STRONG 💪“ followed by the site URL.
- Badge: ink #111111 pill, white Manrope 800 „I AM STRONG“, powder #E5A9AE dot before it, site host (from `APP_URL`) below in white Manrope 400.
- Nobody but the owner reads a photo: no admin policy, nothing for anon. EXIF never survives (canvas re-encode).
- New migration only; `security definer` + `set search_path = ''`; explicit `revoke all … from anon, authenticated` then targeted grants; no schema-wide statements.
- Design rules: tokens (ink, sand, powder, powder-light, powder-chip, rose-deep, ink-soft, line), Manrope, powder never as text colour, one primary button per screen, 44 px touch targets, lucide icons, Bulgarian copy.
- Next 16 page pattern: sync default export → `<Suspense>` → async inner that first `await connection()`; `params` is a Promise; env read only in `src/app/**`.
- Commands: `export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg`; `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm db:reset`, `pnpm db:types`. Never touch any container except `*_fit-platform`.

## Review Focus

1. A second member requests `/app/progress/photos/<first member's id>` or her storage path → 404 / storage denies (Task 1 DB test, Task 3 service test).
2. Upload succeeds but recording the row fails (limit hit, bad date) → the uploaded object is removed, error shown (Task 4 client + Task 1 limit test).
3. Account deletion with photos → no object left under `{uid}/` (Task 3 test).
4. Portrait vs landscape vs square photos in the cover crop → no stretching, centre crop (Task 2 geometry tests).
5. Browser without Web Share file support (desktop) → the image downloads as `progres.jpg` (Task 5 uses `pickShareMode`, covered by its existing tests; Task 5 test for the share-text builder).

---

### Task 1: Database — bucket, policies, table, functions

**Files:**
- Create: `supabase/migrations/20261023100000_progress_photos.sql`
- Create: `supabase/tests/progress-photos-db.test.ts`
- Modify: `supabase/tests/privileges.test.ts` (add `"progress_photos"` to `TABLES`)
- Modify: `src/lib/supabase/database.types.ts` (regenerate with `pnpm db:types`)

**Interfaces:**
- Produces: table `public.progress_photos(id uuid pk default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, path text not null unique, taken_on date not null, created_at timestamptz not null default now())`, index on `(user_id, taken_on desc, created_at desc)`; RPC `add_progress_photo(p_path text, p_taken_on date) returns uuid`; RPC `delete_progress_photo(p_id uuid) returns void`.

- [ ] **Step 1: Write the failing DB tests** using `helpers.ts` (`createUser`/test users, `adminClient`, `anonClient`). A tiny valid JPEG byte array (`FF D8 FF E0 … FF D9`) is uploaded with `contentType: "image/jpeg"`. Tests:
  - `member uploads into her own folder and reads it back` — upload to `${uid}/${randomUUID()}.jpg` succeeds; `download` succeeds.
  - `member cannot upload, read or delete in another member's folder` — upload to `${otherUid}/…` errors; `download` of the other's object errors; `remove` of it leaves the object (admin `list` still sees it).
  - `anon cannot read` — `anonClient().storage.from("progress-photos").download(path)` errors.
  - `bucket refuses png and files over 5 MB` — `contentType: "image/png"` errors.
  - `add_progress_photo records her photo and is idempotent` — returns a uuid; calling again with the same path returns the same id; `select` from `progress_photos` as her shows one row with the given `taken_on`.
  - `add_progress_photo refuses` each: another member's folder path, a path not matching the regex (`${uid}/x.jpg`), a path whose object does not exist, `taken_on` tomorrow (Sofia), `1999-12-31` → rpc error.
  - `limit 200` — insert 200 rows for a user directly with the admin client (paths unique, no objects needed), then `add_progress_photo` with a real uploaded object errors with message containing `200`.
  - `members see only their own rows; direct insert/update/delete are denied`.
  - `delete_progress_photo deletes only her own row` — her id → row gone; other member's id → row still there (admin check).
  - `profile deletion cascades rows`.

- [ ] **Step 2: Run** `pnpm test:db supabase/tests/progress-photos-db.test.ts` — Expected: FAIL (bucket/table missing).

- [ ] **Step 3: Write the migration.** Bucket insert `on conflict (id) do nothing` (as `20261015100100_admin_tables.sql` does for `thumbnails`). Storage policies `progress_photos_own_select|insert|delete` on `storage.objects` `to authenticated` with `bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text`. Table + RLS `enable`, policy select `user_id = (select auth.uid())`; `revoke all on public.progress_photos from anon, authenticated; grant select on public.progress_photos to authenticated;`. Functions `security definer set search_path = ''`, `revoke all on function … from public, anon, authenticated; grant execute … to authenticated;`. `add_progress_photo`: raise `42501` when `auth.uid()` is null; validate path with the Global Constraints regex built from `auth.uid()::text`; existing row with that path and her user_id → return its id; `exists (select 1 from storage.objects where bucket_id = 'progress-photos' and name = p_path)` else raise `P0002`; date bounds using `(now() at time zone 'Europe/Sofia')::date`, else `22023`; take `pg_advisory_xact_lock(hashtext('progress_photos:' || uid))`, count ≥ 200 → raise `P0001` with message `'Можеш да пазиш до 200 снимки. Изтрий някоя стара, за да добавиш нова.'`. `delete_progress_photo`: `delete … where id = p_id and user_id = auth.uid()`.

- [ ] **Step 4: Apply and regenerate.** `pnpm db:reset` then recreate the local test accounts with the existing seed steps if the dev links are needed later; `pnpm db:types`. Run `pnpm test:db supabase/tests/progress-photos-db.test.ts supabase/tests/privileges.test.ts` — Expected: PASS. Then the whole `pnpm test:db` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(db): private progress photos bucket, table and functions`.

### Task 2: Pure helpers — geometry, paths, share text

**Files:**
- Create: `src/lib/photos/geometry.ts`, `src/lib/photos/geometry.test.ts`
- Create: `src/lib/photos/path.ts`, `src/lib/photos/path.test.ts`
- Create: `src/lib/photos/share-text.ts`, `src/lib/photos/share-text.test.ts`

**Interfaces:**
- Produces:
  - `scaleToMax(width: number, height: number, max: number): { width: number; height: number }` — integer sizes, never upscales.
  - `coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number }` — centre crop of the source with the destination's aspect ratio.
  - `UPLOAD_MAX_SIDE = 1600`, `UPLOAD_QUALITY = 0.85`, `SHARE_W = 1080`, `SHARE_H = 1350`, `DIVIDER = 6`, `MAX_PHOTOS = 200`.
  - `photoPath(userId: string, id: string): string` → `${userId}/${id}.jpg`; `isOwnPhotoPath(userId: string, path: string): boolean` (the Global Constraints regex).
  - `progressShareText(siteUrl: string): string` → `"Моят прогрес с I AM STRONG 💪\n" + siteUrl` (siteUrl omitted with its newline when empty).

- [ ] **Step 1: Write failing tests:** `scaleToMax(4000, 3000, 1600)` → `{1600, 1200}`; `(3000, 4000, 1600)` → `{1200, 1600}`; `(800, 600, 1600)` → `{800, 600}`; `(1601, 1, 1600)` height ≥ 1. `coverCrop(4000, 3000, 1080, 1350)` → `sh = 3000`, `sw = 2400`, `sx = 800`, `sy = 0`; `coverCrop(3000, 4000, 540, 1350)` → `sw = 1600`, `sx = 700`, `sh = 4000`; `coverCrop(1080, 1350, 1080, 1350)` → whole image; result always within the source bounds. `isOwnPhotoPath` true for `photoPath(uid, randomUUID())`; false for another uid prefix, `../`, uppercase hex, `.png`, missing extension, extra folder. `progressShareText("https://x.bg")` exact string; `progressShareText("")` → `"Моят прогрес с I AM STRONG 💪"`.
- [ ] **Step 2: Run** `pnpm test src/lib/photos` — FAIL.
- [ ] **Step 3: Implement** the three files (sizes rounded with `Math.round`, crop values rounded and clamped).
- [ ] **Step 4: Run** `pnpm test src/lib/photos` — PASS.
- [ ] **Step 5: Commit** `feat(photos): geometry, path and share-text helpers`.

### Task 3: Server service, account deletion and export

**Files:**
- Create: `src/server/progress/photos.ts`
- Create: `supabase/tests/progress-photos-service.test.ts`
- Modify: `src/server/profile/profile.ts` (`deleteAccount`, `exportMyData`)
- Modify: `supabase/tests/profile.test.ts` (deletion + export cases)

**Interfaces:**
- Consumes: Task 1 RPCs/table; Task 2 `isOwnPhotoPath`, `MAX_PHOTOS`.
- Produces (all take the member's own `TypedClient` unless noted):
  - `type ProgressPhoto = { id: string; takenOn: string; createdAt: string; path: string; url: string | null }`
  - `listProgressPhotos(db: TypedClient, opts?: { limit?: number }): Promise<ProgressPhoto[]>` — newest `taken_on` first, then `created_at` desc; one `createSignedUrls(paths, 3600)` call; `url` null when signing failed for that path.
  - `getProgressPhoto(db: TypedClient, id: string): Promise<ProgressPhoto | null>` — null for a malformed id or another member's photo.
  - `recordProgressPhoto(db: TypedClient, input: { path: string; takenOn: string }): Promise<string>` — RPC `add_progress_photo`; maps P0001/22023/42501/P0002 to `AppError("VALIDATION", <Bulgarian message>)` (limit message from the DB; date: „Датата трябва да е до днес.“; others: „Снимката не се качи. Опитай пак.“).
  - `deleteProgressPhoto(db: TypedClient, id: string): Promise<void>` — loads her row (none → `AppError("NOT_FOUND", …)`), `storage.remove([path])` (error → throw, row untouched), then RPC `delete_progress_photo`.
  - `removeAllProgressPhotos(admin: TypedClient, userId: string): Promise<void>` — lists `progress-photos` under `userId` page by page (limit 100) and removes them; any error throws.
  - `exportMyData` gains `progress_photos: { taken_on; created_at; url; url_expires_in_seconds: 3600 }[]`.

- [ ] **Step 1: Write failing DB tests:** list order and signed URLs that fetch with status 200; `limit`; another member's id via `getProgressPhoto` → null; malformed id → null; `recordProgressPhoto` with a future date → AppError VALIDATION; `deleteProgressPhoto` removes object and row; `deleteProgressPhoto` of another member's id → NOT_FOUND and her object stays; `deleteAccount` for a member with two photos leaves `admin.storage.from("progress-photos").list(uid)` empty; `deleteAccount` aborts (throws, user still exists) when `removeAllProgressPhotos` fails (inject via a wrapped admin client whose `storage.from().remove` returns an error, matching how existing profile tests inject failures); `exportMyData` contains `progress_photos` with a working URL.
- [ ] **Step 2: Run** `pnpm test:db supabase/tests/progress-photos-service.test.ts supabase/tests/profile.test.ts` — FAIL.
- [ ] **Step 3: Implement** the service; in `deleteAccount` call `removeAllProgressPhotos(admin, userId)` after the subscription guard and before the visits deletion; extend `exportMyData` (signing with the member's own client, the same `db` the function already uses for her rows).
- [ ] **Step 4: Run** the two files, then full `pnpm test:db` and `pnpm typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(photos): progress photo service, removal on account deletion, export`.

### Task 4: Upload and gallery screens

**Files:**
- Create: `src/app/app/progress/photos/actions.ts` (`"use server"`)
- Create: `src/app/app/progress/photos/page.tsx`
- Create: `src/components/photos/photo-upload.tsx` (`"use client"`)
- Create: `src/components/photos/photo-grid.tsx`
- Create: `src/lib/photos/compress.ts` (browser-only; not unit-tested — canvas)
- Create: `src/lib/photos/upload-errors.ts`, `src/lib/photos/upload-errors.test.ts`
- Modify: `src/app/app/progress/page.tsx` (section „Снимки“)
- Modify: `src/app/app/profile/page.tsx` (card „Снимки на прогреса“ under the Прогрес link, same row style with lucide `Camera`)

**Interfaces:**
- Consumes: Task 2 `scaleToMax`, `UPLOAD_MAX_SIDE`, `UPLOAD_QUALITY`, `photoPath`; Task 3 `listProgressPhotos`, `recordProgressPhoto`.
- Produces:
  - `compressPhoto(file: File): Promise<Blob>` — `createImageBitmap(file, { imageOrientation: "from-image" })`, canvas at `scaleToMax(…, 1600)`, `toBlob("image/jpeg", 0.85)`; throws `PhotoDecodeError` when decoding fails.
  - `addProgressPhoto(input: { path: string; takenOn: string }): Promise<ActionResult<{ id: string }>>` (uses `requireUser`, zod: `path` string, `takenOn` `YYYY-MM-DD`; `revalidatePath("/app/progress")` and `"/app/progress/photos"`).
  - `uploadErrorMessage(error: unknown): string` — `PhotoDecodeError` → „Не успяхме да отворим снимката. Опитай с JPG или PNG.“; a storage error with status 413 / message containing „size“ → „Снимката е твърде голяма.“; anything else → „Снимката не се качи. Опитай пак.“
  - `<PhotoUpload userId={string} today={string} />` — hidden file input `accept="image/*"` behind a button „Добави снимка“, a date input (default `today`, `max={today}`), busy state „Качваме…“, on success `router.refresh()`; when `addProgressPhoto` fails after the upload succeeded, it calls `storage.from("progress-photos").remove([path])` before showing the error.
  - `<PhotoGrid photos={ProgressPhoto[]} />` — 3 columns mobile / 4 desktop, square tiles `object-cover`, `<img loading="lazy" alt="Снимка от {дата}">` (eslint-disable comment as in `article-body.tsx`), date under each, each tile links to `/app/progress/photos/{id}`; `url` null → sand tile with „Неналична“.
- Copy: page title „Снимки на прогреса“; empty state „Първата снимка е най-важната — след месец ще се радваш, че я имаш.“; privacy line under the title „Снимките виждаш само ти.“; Прогрес section heading „Снимки“, up to 6 newest, link „Всички снимки“ (shown when there is at least one photo), `PhotoUpload` button is the secondary style on Прогрес (the page already has the primary „Отбележи седмицата“) and primary on the photos page.

- [ ] **Step 1: Write failing test** `upload-errors.test.ts` for the three messages.
- [ ] **Step 2: Run** `pnpm test src/lib/photos/upload-errors.test.ts` — FAIL.
- [ ] **Step 3: Implement** the files above. `today` is computed on the server in Europe/Sofia (`Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Sofia" })`).
- [ ] **Step 4: Verify** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — PASS. Then in the browser pane (`fit-platform-dev`, signed in through `scripts/local-login-links.mjs`): upload `public/photos/step-1.jpg` from the photos page, see it in the grid and on Прогрес; screenshot.
- [ ] **Step 5: Commit** `feat(photos): upload, gallery, progress and profile entry points`.

### Task 5: Photo screen, branded share image, before/after, delete

**Files:**
- Create: `src/app/app/progress/photos/[id]/page.tsx`
- Create: `src/components/photos/photo-share.tsx` (`"use client"`)
- Create: `src/lib/photos/share-image.ts` (browser canvas drawing)
- Create: `src/components/photos/delete-photo.tsx` (`"use client"`)
- Modify: `src/app/app/progress/photos/actions.ts` (`removeProgressPhoto`)

**Interfaces:**
- Consumes: Task 2 `coverCrop`, `SHARE_W`, `SHARE_H`, `DIVIDER`, `progressShareText`; Task 3 `getProgressPhoto`, `listProgressPhotos`, `deleteProgressPhoto`; existing `pickShareMode` from `src/lib/share/share-mode.ts`.
- Produces:
  - `drawShareImage(input: { after: { url: string; takenOn: string }; before?: { url: string; takenOn: string }; host: string }): Promise<File>` — fetches each URL as a blob (`cache: "no-store"`), `createImageBitmap`, loads `FontFace("Manrope", "url(/fonts/manrope-800.ttf)", { weight: "800" })` and the 400 file, draws per the spec (single: cover photo, bottom ink gradient, date bottom-left, badge; pair: two halves, divider, „ПРЕДИ“/„СЛЕД“ chips with dates, badge bottom-centre), returns `new File([blob], "progres.jpg", { type: "image/jpeg" })` at quality 0.9. Dates formatted `bg-BG` „12 октомври 2026“.
  - `<PhotoShare after={…} candidates={{ id; url; takenOn }[]} host={string} siteUrl={string} />` — mode toggle „Само снимката“ / „Преди / След“ (toggle hidden when `candidates` is empty; default ПРЕДИ = the earliest candidate; a horizontal strip of candidate thumbnails selects another ПРЕДИ, `aria-pressed`), a live preview `<img>` of the prepared file (object URL, revoked on change), the primary button „Сподели“. Prepares the file whenever the mode/ПРЕДИ changes; on tap uses `pickShareMode`: `files` → `navigator.share({ files, text })`; `text` or `download` → download `progres.jpg` and copy the text (same behaviour and AbortError handling as `ShareButton` in `src/components/workout/share-button.tsx`).
  - `removeProgressPhoto(id: string): Promise<ActionResult<null>>` → `deleteProgressPhoto`, then `redirect("/app/progress/photos")`.
  - `<DeletePhoto id={string} />` — text button „Изтрий снимката“; first tap shows „Сигурна ли си? Снимката изчезва завинаги.“ with „Изтрий“ (danger style if one exists in `buttonClass`, else secondary) and „Отказ“.
- Page `/app/progress/photos/[id]`: `getProgressPhoto` null → `notFound()`; back link „Всички снимки“; the date as heading; `PhotoShare` with candidates = her other photos taken before or on the same day as this one, excluding itself (from `listProgressPhotos`); `DeletePhoto`. `host`/`siteUrl` come from `serverEnv.APP_URL` read in the page (env only in `app/**`).

- [ ] **Step 1: Write failing test** in `src/lib/photos/share-text.test.ts` (extend) or a new `src/lib/photos/pair.test.ts` for a pure helper `defaultBefore(candidates: { id: string; takenOn: string }[]): string | null` (earliest `takenOn`, ties → first in input; empty → null), exported from `src/lib/photos/geometry.ts`'s sibling `src/lib/photos/pair.ts`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `pair.ts` and the files above. **Step 4: Run** `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — PASS.
- [ ] **Step 5: Verify in the browser pane:** with two uploaded photos, open the newer one; the preview shows the badge; switch to „Преди / След“ and the preview shows both halves with chips; screenshot both. Visit the photo URL signed in as the other test account → 404. Delete a photo → back on the grid, gone.
- [ ] **Step 6: Commit** `feat(photos): photo screen with branded share image, before/after and delete`.
