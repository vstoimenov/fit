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
