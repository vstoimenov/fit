# Phase 4 — Community — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans) by the session controller.

**Goal:** A members-only feed with posts (text + one photo), comments, hearts, reports, points with the daily cap, a „Общност“ tab, Начало teaser, after-workout share and admin moderation.

**Spec:** `docs/superpowers/specs/2026-10-27-fit-platform-community-design.md`.

## Global Constraints
- Every write through security-definer RPCs with `search_path = ''`; members never insert into the tables or the ledger directly; `my_access()` on every read and write; admins through `is_admin()`.
- Points: post 3 / comment 1 / combined cap 5 per Sofia day, enforced in SQL; idempotent by ledger ref.
- Photos: private bucket, own-folder upload only, read only with access, signed URLs server-side.
- Design rules of the app; Bulgarian copy; 44 px targets; hydration-safe client components.
- Tests first: DB (RLS, RPC rules, cap), unit (pure helpers), browser for the pages.

## Tasks
1. **DB** `20261027140000_community.sql` + `supabase/tests/community.test.ts`.
2. **Pure helpers** `src/lib/community/{name,relative-time,limits}.ts` + tests (display name „Мария П.“, „преди 5 мин“, text limits).
3. **Server** `src/server/community/{feed,write,admin}.ts` (+ signed photo URLs), actions.
4. **Member UI** `/app/community`, `/app/community/[id]`, composer with photo (reuse compress + browser storage upload), post/comment cards, heart, report dialog, own delete; nav tab (bar + sidebar + icons + `app-nav.ts`); after-workout share link; Начало teaser; learn community card.
5. **Admin** `/admin/community` reports + moderation, nav „Общност“; README notes.
6. Verify in the browser (post with photo, heart, comment, report, admin hide, points cap), commit.

## Ledger
- Task 1 complete: migration `20261027140000_community.sql` (4 tables with no API grants, private bucket + policies, RPCs for every read/write, display name „Първо И.“, points post 3 / comment 1 capped at 5 per Sofia day, admin moderation + reports); DB tests 4/4 + privileges list.
- Task 2 complete: `relativeTime` (2/2). Task 3 complete: `parseFeed`/`parsePost` (2/2), `feed.ts` (signed photo URLs), `write.ts`, `admin.ts`.
- Task 4 complete: `/app/community` (composer with browser-compressed photo upload to her own folder, feed, „Още“), `/app/community/[id]` (comments, report, delete own), „Общност“ tab (bar + sidebar; „Хранене“ leaves the bar per the engagement spec and stays on Начало/Профил), after-workout „Сподели в общността“, Начало „От общността“, learn card points inside.
- Task 5 complete: `/admin/community` (open reports with text: hide/unhide, delete, dismiss; latest posts), nav, README.
- Ruling: feed/post RPCs raise 42501 for members without access (not an empty list) — one rule for reads and writes. Cost if wrong: none; the page shows the plans card instead.
- Ruling: reports are deduplicated per reporter and item; hiding resolves its reports. Cost if wrong: a second report from the same person is silently merged.
- Ruling: the daily community cap is applied inside the award function (partial award) rather than refusing the post. Cost if wrong: none for members; the ledger never exceeds 5/day.
- Task 6: browser-verified on the dev server — the „Общност“ tab, composer → post appears with the author's name, heart 0→1, comment on the post page, ledger holds post 3 + comment 1, „Сигнал“ as another member → „Благодарим, ще го прегледаме.“, `/admin/community` lists the report with the quoted text and the moderation buttons. Not driven in the browser: the photo upload (file picker) — covered by the storage policy + `create_post` path check in the migration and the compress/upload code reused from progress photos.
- Final review (Opus, whole branch 5214708): Critical 1 (photo privacy and cleanup), Important 7 (cap race, composer keeps the photo after a post, moderation gaps, audit of deleted posts, heart revalidation cost, export/account deletion, Хранене unreachable from Профил, test gaps). One fix pass, every item RED→GREEN in `supabase/tests/community.test.ts` / `profile.test.ts` first:
  - Final: fixed photo privacy — storage read policy narrowed to `community_photo_readable(name)` (own folder, admin, or a visible post that uses the path); `delete_own_post`/`admin_delete_post` return the photo path and the callers remove the object; `removeAllCommunityPhotos` on account deletion — tests „photo policies“ + „deleteAccount“ RED→GREEN.
  - Final: fixed cap race — `pg_advisory_xact_lock` per member around the post/comment limits and the points award; `toggle_heart` uses `insert … on conflict do nothing` and returns `{hearted, hearts}` — tests „limits“, „hearts“ RED→GREEN.
  - Final: fixed composer — `createPostAction` returns `{status: "ok", token}` instead of redirecting; the composer clears the photo and preview on a new token and refreshes the feed; file input disabled while pending.
  - Final: fixed moderation gaps — hide/unhide/delete on every post in the admin table, comment reports get hide/unhide + `admin_delete_comment`, „Изтрий публикацията“ only for post reports; audit trigger fires on update only (no orphan rows for deletes).
  - Final: fixed heart — no revalidation on toggle (fresh count from the RPC), constant `aria-label` with the count.
  - Final: fixed export — `community: {posts, comments, hearts, reports}` through the service role (tables have no member grants); „Към дневника за хранене“ link on the Профил card.
  - Final: fixed from the minors while in the same files — `before` cursor validated with `Date.parse`, controls hidden on a hidden post, P0002/22023 copy, per-row report parsing, Home teaser skips hidden posts, object URLs revoked, 44 px remove button, visible focus on the photo label, general whitespace trim in `community_display_name`.
  - Suite after the pass: typecheck/lint clean, unit 888/888, DB community + profile + privileges 30/30, `pnpm build` exit 0; browser: heart 0→1→0 with the server count, post without redirect (textarea cleared, post listed), admin table actions, Профил link.
- Final: Ruling: the user_id inside signed photo URLs stays — no RPC takes another member's id and the narrowed policy stops folder enumeration. Cost if wrong: a member learns another's uuid, which no endpoint accepts.
- Final: Ruling: EXIF stripping is browser-side only (a direct API upload could skip it) — it protects only her own privacy. Cost if wrong: her own GPS data in her own photo.
- Final: Ruling: signed URLs live 1 h and may be served from the router cache on back navigation; the page is dynamic and refetches on the next visit. Cost if wrong: a broken image until refresh.
- Final: minor (deferred): the 5-post limit is rolling 24 h while the copy says „Опитай утре“; delete-and-repost bypasses the post/comment counts (points stay capped).
- Final: minor (deferred): the admin report card shows the text but not the photo.
- Final: minor (deferred): on `/app/community/[id]` the admin sees hidden comments unmarked and the comment count differs from the feed.
- Final: minor (deferred): Home and the admin page sign photo URLs they do not render.
- Final: minor (deferred): reports have no rate limit, can be re-filed after a dismissal and have no unique index behind the dedupe.
- Final: minor (deferred): the repeated „Сигнал“/„Изтрий“ buttons carry no per-item accessible context.
- Final: minor (deferred): a member without access gets 404 on a post page but the plans card on the feed; a lapsed member has no UI path to delete her own posts; „Сподели в общността“ after the free first workout leads to the plans card.
- Final: minor (deferred): feed cursor ties on equal `created_at`; report form layout inside the post header.
