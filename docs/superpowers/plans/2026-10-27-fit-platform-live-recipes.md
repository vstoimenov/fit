# Phase 3 — Live sessions + recipes — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans) by the session controller.

**Goal:** The owner schedules live sessions (Zoom/YouTube link, later a recording); members see the next one on Начало with „Добави в календара“ and tap „Влизам“ at start time (5 points once per session); recordings and recipes live in „Полезно“, articles get a category.

**Spec:** `docs/superpowers/specs/2026-10-22-fit-platform-engagement-design.md` → “Phase 3 — Live + recipes (outline)”. Builder's calls below.

## Builder's calls (controller)
- `live_sessions(id, title, description, starts_at, duration_min 15–180, join_url https, recording_url https|null, published, created_at, updated_at)`; admins CRUD through RLS; members with access read published rows; a recording stays visible to members after the session.
- „Влизам“ window: from 15 min before `starts_at` to `starts_at + duration_min`. `attend_live(p_session_id)` (security definer) checks access, window and published, inserts `live_attendance(user_id, session_id)` once; a trigger awards 5 points (`source = 'live'`, `ref = session id`) idempotently — same pattern as challenges. The member is then sent to `join_url` (opens in a new tab).
- Home card: the next published session starting after `now − duration` (so a running one still shows), with countdown copy, „Добави в календара“ (`/api/live/[id]/calendar.ics`, members only) and „Влизам“ when in window.
- „Полезно“: chips „Всичко / Статии / Рецепти / Записи“; recipes are `articles.category = 'recipe'`; „Записи“ lists sessions with `recording_url`, newest first (opens the recording, same facade as the trainer video).
- Admin „На живо“ (`/admin/live`): list (upcoming + past), create/edit form (title, description, date-time local Sofia, duration, join link, recording link, published), attendance count per session. Admin articles form gets a „Вид“ select (статия / рецепта).
- Points caps per the spec: live attendance 5, once per session (the unique ledger ref enforces it).

## Tasks
1. **DB** `20261027130000_live_recipes.sql`: `articles.category`, `live_sessions`, `live_attendance`, `attend_live`, points trigger, RLS; `supabase/tests/live.test.ts` (member access rules, window, idempotent points, category filter).
2. **Pure helpers** `src/lib/live/window.ts` (`liveState(session, now)` → `upcoming | open | ended`, `joinOpensAt`), `src/lib/live/ics.ts` (`buildIcs(session, appUrl)`) + tests.
3. **Server** `src/server/live/{sessions,admin}.ts` (`nextLiveSession`, `listRecordings`, `attendLive`, admin list/save/delete/attendance counts); articles `category` in `listArticlesFor(db, level, category?)` and admin schema.
4. **Member UI** Home live card (`src/components/home/live-card.tsx`, client countdown + „Влизам“ action), `/api/live/[id]/calendar.ics`, „Полезно“ chips + recordings list.
5. **Admin UI** `/admin/live` list + form + nav „На живо“; „Вид“ select in the article form; README line.
6. Verify in the browser (home card states, join → points, учебно: recordings list, admin), commit.

## Ledger
- Tasks 1–5 complete: migration `20261027130000_live_recipes.sql` (articles.category, live_sessions, live_attendance, `attend_live`, points trigger; DB tests 4/4), `liveState`/`buildIcs` (3/3), `pickNextSession`/`liveInputSchema` (3/3), home `LiveCard` + `attendLiveAction`, `/api/live/[id]/calendar.ics`, „Полезно“ chips (Всичко/Статии/Рецепти/Записи), `/admin/live` list + create/edit/delete, article „Вид“ select, nav, README.
- Task 6: browser-verified on the dev server — Начало shows „На живо сега“ with „Влизам“; the tap records attendance and the ledger holds 5 `live` points once (button turns „Влез пак“, status „Отбелязахме те · +5 точки“); „Полезно → Записи на живо“ lists the past session with its recording. Opus review dispatched; test sessions exist in the LOCAL db only.
- Ruling: „Влизам“ is a real link to the room (new tab) that also records attendance; the points are not conditional on the room actually opening. Cost if wrong: a tap without joining earns 5 points once.
- Final review (Opus): 0 Critical, 4 Important, 15 Minor. Fix pass (one commit), tests first where a unit exists:
  - start time formatted on the server in the member's own timezone (`formatLiveStart`, zone named when not Sofia; unit tests) — no Sofia-only text, no hydration risk.
  - „Влизам“ is now `/api/live/[id]/join`: attendance is recorded in the same navigation that redirects (302) to the room — middle-click, long-press and a backgrounded PWA cannot lose it; browser-verified (opaque redirect + attendance row + 5 points).
  - attendance is history: `on delete restrict` + a clear admin message, `live_sessions_audit` trigger, delete action redirects and checks the row count; DB test for RPC-only writes and delete protection.
  - admin articles list has a „Вид“ column and Всички/Статии/Рецепти chips (spec: filter in admin).
  - minors done: `\;` escaping (test fixed too), DTSTAMP = generation time, trailing-slash-safe URL, `key` on the home card, `Object.hasOwn`, recordings = past sessions only, shared `MAX_DURATION_MIN`, copy „абонатки“/„Вече си отбелязана“, empty sections hidden in „Всичко“.
- Final: minor (deferred): no SEQUENCE / 75-octet folding in the .ics; two primary buttons on Начало while a session is open; recipe marker on the home article card; DB tests for an admin attending without a subscription and for an unpublished session after attendance; options object for `listArticlesFor`.
- Final: Ruling: recordings open in a new tab instead of the trainer-video facade — the plan said facade, but a recording may be a Zoom cloud link that `parseVideoUrl` cannot embed. Cost if wrong: one extra tap to watch inside YouTube.
- Final: Ruling: iOS behaviour of `<a download>` for the .ics and of `target=_blank` to Zoom is unverified (no device).
