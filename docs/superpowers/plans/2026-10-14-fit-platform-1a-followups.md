# Plan 1A — follow-ups for plans 1B–1D and go-live

Collected from the task reviews and the final whole-branch review of plan 1A (branch `plan-1a`).

## Before / in plan 1B (admin)
- [x] Never hard-delete workouts: `workout_completions` cascade from `workouts` → done in 1B (RLS blocks deletes + FK `restrict`; "Скрий" unpublishes).
- [x] `is_admin()` must require `auth.jwt()->>'aal' = 'aal2'` (admin 2FA) — done in 1B, single place for all policies.
- [x] Trigger to sync `profiles.email` when `auth.users.email` changes — done in 1B.
- [x] Thumbnails: own-CDN allow-list enforced in the admin upload — done in 1B (storage bucket allow-list).
- [x] Video link input: clear Bulgarian error for scheme-less links + adversarial parser tests (lookalike hosts, uppercase, user@host) — done in 1B.
- [x] `getTodayView`: distinguish profile query errors from "not found" — done in 1B.
- [ ] Admin can open a draft workout by URL in the client app (acts as preview) — decide if intended. (1B added "Preview as client"; it needs the admin's own profile onboarded.)

## Deferred from plan 1B (admin)
### Plan 1C (payments)
- [x] Former paid customers cannot get a manual grant → done in 1C (`admin_grant_manual` RPC replaces a non-live row of any provider, refuses while a paid subscription is live).
- [x] Snapshot plan price/interval on `subscriptions` so MRR does not change retroactively when a plan price is edited → done in 1C (`price_cents`, `billing_interval`; `admin_dashboard` reads the snapshot first).
- [x] Define `canceled_at` semantics for churn → done in 1C: `canceled_at` = when the subscription ended at the provider (clamped so access never extends past it); a pending cancel is `cancel_at_period_end`, not `canceled_at`.
### Later
- At-risk and activity recompute stats per page on every request — move to dedicated SQL (view/RPC) when the client count grows.
- Calendar list is limited to 500 workouts — paginate/window by month.
- Calendar drag-and-drop is mouse-only — add keyboard/touch alternative.

## Plan 1C (payments)
- [x] `payment_events` must NOT cascade from `profiles` (accounting records outlive account deletion) → done in 1C (no FK on `user_id`).
- [x] Account deletion must cancel the provider subscription before `deleteUser` → done in 1C (refused if the provider cannot be reached).
- [ ] `rateWorkout` ignores 0-row updates and the player ignores its result.
- [ ] Yearly plan card: show saving vs 12 × monthly (today it shows the per-month price only).

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
- Go-live: turn admin TOTP back on if it was switched off for testing: `update public.security_flags set enabled = true, updated_at = now() where key = 'admin_mfa_required';` (README "Hosted go-live checklist", step 5).
- Hosted Supabase setup: see README "Hosted go-live checklist" (seed content, auth config push, env vars).

## From the plan 1B final review
- Go-live: decide `audit_log` retention / pseudonymisation after account deletion; document that `client_notes` is the client-relationship trail (or merge it into the audit viewer); owner decision on sending „Липсваш ни" without marketing consent + an opt-out line in the template.
- 1C: a `public_settings()` (or server-side service-role) read path for `payment_provider` and tracking IDs (settings are admin-only today) → payment provider done in 1C (`active_payment_provider()`), tracking IDs still open for 1D; switch `subscriptions`/`plans` to column grants or definer RPCs before adding any client-facing write policy; keep admin price edits in sync with Stripe/Revolut price ids (or freeze price once a provider price exists) → done in 1C (price lock + one-plan-per-price rule); consider an `actor_kind` column so webhook audit rows ("система") can be filtered; a service-role-only function for any cron that needs at-risk data (admin RPCs refuse the service role).
- 1D: CSP must allow `img-src data:` (MFA QR) and the Supabase storage origin (thumbnails); a cached tracking-settings reader needs `revalidateTag` from `saveTrackingAction`; random-window DB tests (~0.2% collision) before CI.
- Later: calendar confirm for re-publishing a completed draft dragged from the drafts list; concurrent manual grants may lose an increment.

## New from plan 1C (payments)
- Revolut adapter: `src/server/payments/revolut-provider.ts` is a stub; needs a Revolut Business merchant sandbox to verify the Merchant API subscription flow first.
- `invoice.payment_failed` email to the client (stage 4); today a failed renewal only moves the subscription to `past_due` with a 3-day grace.
- Track purchase events (Pixel/GA4) from `applySubscriptionEvent` (plan 1D).
- Apple Pay domain verification in Stripe at go-live (once the site has its own domain).

## 1C deferred (from task reviews)
- Test gaps: `past_due` in grace / `canceled` in period grant refusal, `P0002` (client not found), customer id survives a grant, yearly snapshot MRR.
- Stripe: only `items[0]` is read (single-plan product). (Date-based `cancel_at` cancels are now mapped to `cancel_at_period_end`.)
- Single-row design: if one user ends up with duplicate live subscriptions, the displaced one is cancelled best effort; concurrent events for two subscriptions can miss that cancel.
- `provider_customer_id` is not unique (lookup uses limit 1); the cancel tests have a 1 s clock-skew margin.
- Webhook: the subscription is re-fetched before dedupe (one extra API call per duplicate delivery); `resource_missing` on a non-delete event answers 500 for the whole retry window; the `past_due` grace is anchored to the event's created time.
- No unit test for the welcome-poll rejection path.
- `savePlan` read-then-write race on the subscriber count; no test that other providers' price ids survive an edit.
- `supabase/tests/access.test.ts` leaves "Скрит" plans behind (no cleanup).
- Real Stripe end-to-end (Checkout, Portal, `expires_at` acceptance, `cancelNow` on a live subscription) is still unverified: needs test keys and a public webhook URL after the Vercel deploy.
- Verify a pasted Stripe Price ID against Stripe (amount, interval, currency, active) in `savePlanAction`; today only the `price_…` format is checked.
- MRR uses the undiscounted `unit_amount`: promotion codes / coupons are not reflected.
- The displaced-subscription cancel is lost if the function dies after the apply and before the cancel (the event is already applied, a retry does not repeat it). Robust fix: on each live event list the customer's other non-canceled subscriptions at Stripe and cancel them.
