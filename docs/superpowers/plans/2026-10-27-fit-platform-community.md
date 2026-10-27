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
