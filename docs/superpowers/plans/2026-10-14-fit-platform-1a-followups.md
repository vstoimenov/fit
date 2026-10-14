# Plan 1A — follow-ups for plans 1B–1D and go-live

Collected from the task reviews and the final whole-branch review of plan 1A (branch `plan-1a`).

## Before / in plan 1B (admin)
- Never hard-delete workouts: `workout_completions` cascade from `workouts` → unpublish/soft-delete instead.
- `is_admin()` must require `auth.jwt()->>'aal' = 'aal2'` (admin 2FA) — single place for all policies.
- Trigger to sync `profiles.email` when `auth.users.email` changes.
- Thumbnails: enforce an own-CDN allow-list in the admin upload (DB CHECK is only a deny-list).
- Video link input: clear Bulgarian error for scheme-less links (`youtu.be/…` without https) or prepend https://; add adversarial parser tests (lookalike hosts, uppercase, user@host).
- `getTodayView`: distinguish profile query errors from "not found".
- Admin can open a draft workout by URL in the client app (acts as preview) — decide if intended.

## Plan 1C (payments)
- `payment_events` must NOT cascade from `profiles` (accounting records outlive account deletion).
- Account deletion must cancel the provider subscription before `deleteUser`.
- `rateWorkout` ignores 0-row updates and the player ignores its result.
- Yearly plan card: show saving vs 12 × monthly.

## Plan 1D (tracking, security, CI)
- Move onboarding consent capture to a security-definer RPC (today the authenticated column grant lets a user set `onboarding_done`, `health_data_consent_at`, `level` directly via PostgREST); store consent text version and a `marketing_consent` timestamp.
- Email confirmation: if turned on, the wizard needs a "check your email" step.
- Rate limiting for `/api/visit`, login, signup; Turnstile.
- CSP with nonces conflicts with `cacheComponents` static shells — decide hash-based CSP vs dynamic root early.
- Visits: retention job; store referrer origin only; beacon counts query-string changes as visits.
- `privileges.test.ts` depends on the docker container name `supabase_db_fit-platform` — CI must run `supabase start` with this project_id.
- Log export failures (Sentry); decide `signOut` scope (global vs local).
- Iframe `sandbox`; the 70% "Завърших" gate is client-only.
- `test:db` fixtures pollute the local dev DB — isolate or clean up.

## Go-live / design pass
- Privacy policy page linked from the health-data consent checkbox (needs legal text).
- Streak counts scheduled workout slots, not calendar days — label it (e.g. "тренировки подред") or revisit.
- English zod defaults still reachable on free numeric inputs (profile height decimals → add `step="1"` / BG messages).
- Covers: decorative ring vs "no icon-in-circle"; long Cyrillic first words get cropped.
- Hosted Supabase setup: see README "Hosted go-live checklist" (seed content, auth config push, env vars).
