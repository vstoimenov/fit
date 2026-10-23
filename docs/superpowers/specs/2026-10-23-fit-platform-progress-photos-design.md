# Fit platform (I AM STRONG) — progress photos with a branded share image

Date: 2026-10-23. Status: the owner asked for the feature and said „измисли го ти“ / „не, направи го“ — every
decision below is the controller's call, stated to the owner before building.

## Why

The owner: members must be able to upload progress photos, keep them in their profile, and share them both in the
community and on social networks, with the platform's logo badge on the image. A before/after picture with the
brand on it is the single most shareable thing a body-change programme produces, and it is free marketing.

## Goals

- A member uploads a photo (camera or gallery) from her phone or desktop; it is stored privately.
- She sees her photos as a dated grid, opens one, deletes one.
- She shares one photo, or a „Преди / След“ pair, as a 1080×1350 (4:5) image that carries an „I AM STRONG“ badge,
  through the phone's share sheet (Instagram, Facebook, WhatsApp…) or as a download on desktop.

## Non-goals

- Sharing into the in-app community: the community does not exist yet (engagement phase 4). It is built next, and a
  community post will then be able to attach a badged progress photo. Not part of this spec.
- Points for photos (would invite farming), admin access to photos, filters/editing, video, captions on the image.
- Renaming the app from „Форма“ to I AM STRONG (separate open item); only the badge says I AM STRONG.

## Anti-goals (failure even if it works)

- Anyone other than her can see a photo: another member, an anonymous visitor, the admin panel, a guessed URL.
- A photo leaks location: GPS/EXIF data must not survive the upload.
- Her weight, waist or name appears on the share image unless she typed it — the image carries only the photo(s),
  the dates/labels and the badge.
- A deleted photo or a deleted account leaves the file in storage.

## Decisions (controller's calls)

**Storage.** Private bucket `progress-photos`, 5 MB limit, `image/jpeg` only. Object path `{user_id}/{uuid}.jpg`.
Storage RLS on `storage.objects` for `authenticated`: select / insert / delete only where `bucket_id =
'progress-photos'` and the first folder equals `auth.uid()::text`. No update policy, no admin policy, nothing for
anon.

**Table.** `progress_photos(id uuid pk, user_id uuid → profiles on delete cascade, path text unique, taken_on date,
created_at timestamptz)`. RLS: she selects her own rows; no direct insert/update/delete grants. Writes go through
`security definer` functions with `search_path = ''`:
- `add_progress_photo(p_path text, p_taken_on date) returns uuid` — path must match
  `^{auth.uid()}/[0-9a-f-]{36}\.jpg$`, the storage object must exist in that bucket, `taken_on` not in the future
  (Europe/Sofia) and not before 2000-01-01, at most 200 photos per member (P0001 with a Bulgarian message);
  duplicate path → the existing id (idempotent).
- `delete_progress_photo(p_id uuid) returns void` — deletes her own row only.
Explicit `revoke all … from anon, authenticated` then grant execute to authenticated, as in earlier migrations.

**Upload flow (client).** File input `accept="image/*"` (no `capture`, so gallery works too). The browser decodes
with `createImageBitmap(file, { imageOrientation: "from-image" })`, scales so the long side is ≤ 1600 px, encodes
JPEG quality 0.85 on a canvas (this drops EXIF/GPS), uploads with the browser Supabase client to
`{uid}/{random uuid}.jpg` (`upsert: false`, `contentType: image/jpeg`), then calls a server action that runs
`add_progress_photo`. Date field defaults to today (Sofia) and can be changed. If decoding fails (e.g. HEIC on a
desktop browser that cannot read it) she gets „Не успяхме да отворим снимката. Опитай с JPG или PNG.“ If the action
fails after the upload, the client removes the uploaded object.

**Delete flow.** Server action: remove the storage object with her session first, then
`delete_progress_photo`. File first so a failure can never leave an orphaned body photo behind a deleted row.

**Viewing.** Server components create signed URLs (1 hour) with her session for the photos on screen and render
plain `<img loading="lazy">` (no next/image: signed URLs on the Supabase host). No image transforms (Pro-only
feature; not relied on).

**Screens.**
- `/app/progress` gets a „Снимки“ section: up to 6 newest as a grid, „Добави снимка“, „Всички снимки“.
- `/app/progress/photos`: full grid (newest first, date under each), „Добави снимка“, empty state
  „Първата снимка е най-важната — след месец ще се радваш, че я имаш.“
- `/app/progress/photos/[id]`: the photo, its date, „Сподели“, „Преди / След“ (pairs this photo as СЛЕД with her
  earliest photo as ПРЕДИ by default; a strip of her other photos lets her pick another ПРЕДИ; hidden when she has
  one photo), „Изтрий“ with a confirm step. Another member's id → 404.
- Профил gets a card „Снимки на прогреса“ → `/app/progress/photos`. All these routes count as Профил in the nav.

**Share image (client canvas, 1080×1350).**
- Single: the photo cover-fitted (centre crop), a bottom ink gradient, the date bottom-left in white, the badge.
- Before/after: two 540×1350 halves cover-fitted, a 6 px white divider, „ПРЕДИ“ / „СЛЕД“ chips with dates at the
  top of each half, the badge bottom-centre.
- Badge: ink (#111111) pill, white Manrope 800 „I AM STRONG“, a powder (#E5A9AE) dot before it; under the pill the
  site host from `APP_URL` in white Manrope 400. Fonts loaded with `FontFace` from `/fonts/manrope-*.ttf`.
- The photos are fetched as blobs from the signed URL (CORS) and drawn from `createImageBitmap`, so the canvas is
  never tainted.
- Sharing reuses the existing pattern (`pickShareMode`): Web Share with the file and the text „Моят прогрес с
  I AM STRONG 💪“ + site URL; otherwise download `progres.jpg`. The image is prepared when the screen opens / the
  pair changes, because share sheets need the tap's user activation.

**Privacy duties.**
- Account deletion removes every object under `{user_id}/` with the admin client before `deleteUser`; a storage
  failure aborts the deletion (same as the existing subscription guard).
- Data export lists `progress_photos` (taken_on, created_at) plus a signed URL per photo valid 1 hour, with a note
  that the links expire.
- Admin panel: nothing. Audit trigger is not added (no admin writes).

## Constraints

Redesign rules (tokens, Manrope, one primary button per screen, 44 px targets, lucide icons, Bulgarian copy); Next 16
cacheComponents page pattern; env only in `app/**`; new migration only, no schema-wide statements; TDD; unit tests via
vitest, DB tests via `supabase/tests` against the local stack.

## Left to the builder

Exact component split, the pure layout helpers (cover-fit crop maths, scale-to-1600 maths, path validation) and their
tests, exact copy of minor labels within the rules above.
