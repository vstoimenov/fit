# Push notifications — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans) by the session controller.

**Goal:** Opt-in Web Push for members (daily reminder, new workout, owner broadcast) with VAPID keys we own.

**Spec:** `docs/superpowers/specs/2026-10-27-fit-platform-push-design.md`.

## Global Constraints
- RLS member-owned rows, `search_path = ''`, no anon grants; service role only inside server code.
- Nothing personal in notification payloads; bodies ≤ 160 chars; one reminder per local day.
- Without `WEB_PUSH_*` env the feature degrades to „скоро“ (no crash, no send).
- Tests: DB (RLS) + unit (send/prune logic with a fake web-push, job selection logic, cron auth) before code; browser check of the card states.

## Tasks
1. **DB** `20261027110000_push.sql`: `push_subscriptions`, `profiles.push_hour`, `profiles.push_reminded_on`, `workouts.notified_at`, `push_sends`; RLS/grants; DB tests `supabase/tests/push.test.ts`.
2. **Env + send** `src/lib/env-schema.ts` (optional VAPID vars, `CRON_SECRET`), `src/server/push/send.ts` (`sendPush`, prune on 404/410, fake-able transport) + unit tests.
3. **Member side** `src/server/push/subscriptions.ts` + actions (`subscribePush`, `unsubscribePush`, `setPushHour`), `src/components/profile/push-card.tsx`, `public/sw.js` push + click handlers, `src/lib/push/` pure helpers (`pushSupport(nav, ua, standalone)`, `urlBase64ToUint8Array`) with tests.
4. **Jobs + cron** `src/server/push/jobs.ts` (`dueReminderUsers(rows, now)` pure + `sendReminders`, `notifyPublishedWorkouts`), `src/app/api/cron/push/route.ts` (`CRON_SECRET`), `vercel.json`; unit tests for selection + auth.
5. **Admin** `/admin/notifications` broadcast (ActionForm) + log, nav „Известия“; `src/server/push/broadcast.ts`; README + go-live notes (generate VAPID keys, set env, Vercel cron).
6. Verify (browser: card states; cron route 401/200 with curl), commit, deploy after the owner applies migrations.

## Ledger
- Task 1 complete: migration `20261027110000_push.sql` (push_subscriptions, profiles.push_hour/push_reminded_on, push_sends; `workouts.notified_at` already existed from the content migration — backfilled as announced), DB tests 4/4, privileges list updated.
- Task 2 complete: env vars (optional VAPID + CRON_SECRET), `send.ts` with fake-able transport (3/3), prune on 404/410.
- Task 3 complete: `subscriptions.ts` (schema 2/2), profile actions, `PushCard`, `public/sw.js` push + notificationclick (cache bumped to v3), `pushSupport`/`urlBase64ToUint8Array` (4/4).
- Task 4 complete: `jobs.ts` (`dueReminders`, `isCronAuthorized`, `reminderBody` 4/4), `/api/cron/push` (401 without the bearer, 200 JSON with it — curl-verified on the dev server with local keys), `vercel.json` hourly cron.
- Task 5 complete: `broadcast.ts` (schema 3/3), `/admin/notifications` with ActionForm + log, nav „Известия“, README setup notes.
- Ruling: reminders are stamped on every due member whether or not a device accepted the push — a dead subscription must not retry every hour. Cost if wrong: a member with a dead device misses one day's reminder; the device is pruned anyway.
- Ruling: „Нова тренировка“ only for workouts published within the last 2 days and with `notified_at` null; everything published before the migration is marked announced. Cost if wrong: none for members; a workout published during a >2-day cron outage is simply not announced.
- Ruling: the broadcast link must be app-relative (`/…`) — no external links in notifications. Cost if wrong: the owner cannot push an external link; she can link a „Полезно“ article instead.
- Verification limits: the pane browser has notifications denied, so the subscribe flow itself (permission prompt → PushSubscription → action) is covered by schema/unit tests and code review, not by a live push. The card's SSR/denied/unsupported states and the admin page were checked in the browser.
- Final review (Opus): 1 Critical, 5 Important, 12 Minor. Fix pass (one commit), each with a failing test first where a unit exists:
  - Critical: hourly `vercel.json` cron would fail every deploy on the Hobby team (confirmed with `vercel teams ls`) — removed; the hour job now runs from Supabase pg_cron + pg_net (`run_push_cron()` reads `app_url`/`cron_secret` from Vault, no-op until set; `push_cron_status()` for tests/admin). DB test: job scheduled.
  - backfill only for workouts already published (`publish_at <= now()`); DB test: a future workout keeps `notified_at` null.
  - endpoint allow-list (FCM, Mozilla, WNS, Apple, Samsung) in zod and the DB check; member insert grant/policy removed (service role only); ≤10 devices per member; web-push `timeout: 10 s`.
  - paging past the 1000-row cap for subscriptions, reminder profiles and the admin count; `.in()` lists chunked by 100; reminders claim `push_reminded_on` first (idempotent across overlapping runs).
  - unique tags (`reminder-<date>`, `workout-<id>`, `broadcast-<ts>`) + `renotify`; SW click stays on our origin, prefers the right tab, never navigates the admin.
  - shared device: a subscription found at load is re-attached to the signed-in member (`claimPushAction`).
  - minors done: `/\\evil.com` links refused via `safeNext`; admin page says whether CRON_SECRET is set and when the last automatic send went; form hidden when not configured; iPad detection; guarded `Notification`; hour set before the device save; write errors logged; GDPR export includes `push_subscriptions`; label mismatch fixed.
- Final: minor (deferred): VAPID key rotation leaves old subscriptions failing with 403 (never pruned); badge icon is full-colour; broadcast success does not show the recipient count; pending label is ActionForm's generic one.
- Final: Ruling: bodies up to 200 chars (plan said 160) — the DB and zod agree on 200; 160 was a guideline. Cost if wrong: a long body is clipped by the OS.
- Final: Ruling: „Нова тренировка“ goes to every subscribed member regardless of level/access (spec) — revisit if daily multi-level drops make it noisy.
