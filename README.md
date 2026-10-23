# fit-platform

Online workout platform for women 25-40: a short onboarding questionnaire, one free first workout, then a paid
subscription with a new workout every few days, a starter week, a library, streaks and progress check-ins.
Installable PWA, Bulgarian UI. Stage 1 design: `docs/superpowers/specs/2026-10-14-fit-platform-stage1-design.md`.

Stack: Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind 4, Supabase (Postgres + Auth, RLS on every
table), Zod, Vitest. **Next.js 16 differs from older versions; read `node_modules/next/dist/docs/` before changing
framework-level code** (see `AGENTS.md`).

## Local setup

Requirements: Node 20+, pnpm, Docker.

```bash
# pnpm lives in ~/.npm-global/bin on the dev machine; DOCKER_CONFIG avoids a hanging credential helper.
export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg

pnpm install
pnpm db:start        # local Supabase stack (API on http://127.0.0.1:55321)
pnpm db:reset        # applies supabase/migrations and runs supabase/seed.sql (demo content)
pnpm db:types        # regenerate src/lib/supabase/database.types.ts after a migration
```

Create `.env.local` from `.env.example`, filling the keys from `pnpm exec supabase status`:

| Variable                        | Where it comes from                                               |
| ------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `API_URL` (local: `http://127.0.0.1:55321`)                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY`                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | `SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`)            |
| `APP_URL`                       | public URL of the app (local: `http://localhost:3120`)            |
| `NEXT_PUBLIC_GOOGLE_AUTH`       | `1` shows the Google button (needs the Google provider), else `0` |
| `STRIPE_SECRET_KEY`             | optional, payments: see "Payments (Stripe)"                       |
| `STRIPE_WEBHOOK_SECRET`         | optional, payments: see "Payments (Stripe)"                       |
| `ANTHROPIC_API_KEY`             | optional, nutrition diary: calories from words                    |
| `NUTRITION_AI_MODEL`            | optional, model override; must accept the fallback beta           |

```bash
pnpm dev             # http://localhost:3120
```

Dev helpers (local database only, they refuse any other host):

```bash
node --env-file=.env.local scripts/dev-grant-access.mjs someone@example.test   # give a user an active subscription
node --env-file=.env.local scripts/dev-set-duration.mjs 1                      # shorten free/starter workouts to 1 minute
```

`pnpm db:reset` undoes both.

## Tests and checks

```bash
pnpm test         # unit tests (Vitest)
pnpm test:db      # database/RLS/service tests against the running local stack (refuses non-local hosts)
pnpm typecheck
pnpm lint         # eslint + prettier --check
pnpm build
```

Never edit an applied migration; add a new one in `supabase/migrations/`.

## Design tokens

Spec: `docs/superpowers/specs/2026-10-16-fit-platform-redesign-design.md`. Tokens live in `src/app/globals.css`
(Tailwind 4 `@theme`), so classes like `bg-powder` and `text-ink-soft` work everywhere, including the admin panel.

| Token          | Hex       | Use                                     |
| -------------- | --------- | --------------------------------------- |
| `ink`          | `#111111` | text, primary buttons                   |
| `ink-soft`     | `#5C5A55` | secondary text (6.9:1 on white)         |
| `white`        | `#FFFFFF` | page background                         |
| `sand`         | `#F4F3F0` | cards, inputs                           |
| `powder`       | `#E5A9AE` | accent: progress bar, active nav icon   |
| `powder-light` | `#FBEFEF` | selected-option background              |
| `powder-chip`  | `#F4D6D6` | chips, active nav pill                  |
| `rose-deep`    | `#7A3B45` | text on powder (6.1:1 on `powder-chip`) |

- Type: Manrope only, weights 400 / 600 / 800.
- UI primitives: `src/components/ui/` (`Button`, `Card`, `Chip`, `Field`, `Consent`, `StatTile`, `AuthCard`).
  Combine classes with `cn()` (`src/lib/cn.ts`, built on `tailwind-merge`) so overrides win over defaults.
- Photos: `public/photos/`, registry in code; sources and licences in `public/photos/CREDITS.md`
  (temporary stock images, to be replaced by own photography).
- Screenshots of the redesign (375 and 1280 px): `docs/screenshots/redesign/`.

### Share card (`/api/share/[completionId]`)

„Сподели" on the after-workout screen fetches a PNG share card (`next/og`). Privacy rule: the image contains only
the workout title, the streak, the week count and the app's own host name; the completion must belong to the
signed-in user (signed out: 401, someone else's or unknown id: 404); the response is `private, no-store`.
No name, weight, measurements or e-mail ever go into the image.

## Admin

- Promote an account (local): `node --env-file=.env.local scripts/make-admin.mjs you@example.com`.
  Hosted: `update public.profiles set role = 'admin' where email = 'you@example.com';` in the SQL editor.
- **Promote an admin and enrol TOTP immediately.** Until a TOTP factor is verified the account is protected only
  by its password. Once one factor is verified, Supabase refuses to enrol another at aal1, so a stranger who
  knows the password cannot add their own authenticator, but only if you enrol first.
- First visit to `/admin` asks for TOTP enrolment (Google Authenticator / 1Password). Every new session needs the 6-digit code.
  Without it the account is treated as a normal client everywhere (the database enforces this via `is_admin()` = role admin + aal2).
- Hosted Supabase: enable **Authentication -> Multi-factor -> TOTP** (enroll + verify), or `supabase config push`.
- **Lost authenticator (admin locked out):** in the Supabase SQL editor run
  `delete from auth.mfa_factors where user_id = (select id from auth.users where email = '…');`,
  then sign in and enrol again at `/admin/mfa`. Only the project owner (SQL editor access) can do this.
- Optional email for "Изпрати съобщение": `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`.
  **The sender address must be verified in Brevo**, otherwise Brevo rejects the send. Without Brevo (or with a
  rejected send) the message is recorded on the client as **NOT sent**; nothing is delivered.
- Workouts that clients completed cannot be deleted (RLS plus a restricting foreign key). "Скрий" turns them back into drafts.
- "Preview as client" needs the admin's own profile to be onboarded.

## Payments (Stripe)

1. Stripe dashboard (test mode first): create a Product „Абонамент" with two recurring Prices (monthly, yearly) in EUR.
2. Settings → Payment methods: enable Cards, Apple Pay, Google Pay (Apple Pay needs the domain verified in Stripe once the site has its own domain).
3. Settings → Customer portal: allow cancel (at period end), update payment method, view invoices; set the return URL to `<APP_URL>/app/profile`.
4. Settings → Billing → Subscriptions and emails: turn on the failed-payment emails to customers (with the link to
   update the card), keep the Smart Retries schedule, and set „if all retries for a payment fail" → **cancel the
   subscription**. The app gives 3 days of access after a failed renewal and then asks her to update the card; a
   subscription left `past_due`/`unpaid` forever would keep blocking a new checkout and manual access.
5. Developers → Webhooks: endpoint `<APP_URL>/api/pay/stripe/webhook`, events
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret.
6. Env: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (Vercel → Project → Environment Variables; never commit them).
7. Admin → Настройки → Планове: paste each Stripe Price ID (`price_…`) into its plan. After that the plan's price is locked; a new price = a new plan.
8. Test card: 4242 4242 4242 4242, any future date, any CVC. Failed renewal test: 4000 0000 0000 0341.
9. Switching to live: repeat 1–7 with live keys and live prices.

Revolut: the provider slot exists (`src/server/payments/revolut-provider.ts`) but is not implemented — it needs a Revolut Business merchant sandbox to verify the Merchant API subscription flow first.

## Hosted go-live checklist

1. **Schema:** `supabase link --project-ref <ref>` then `supabase db push`.
2. **Auth settings:** `supabase config push` (or set them in the dashboard) so the hosted project matches
   `supabase/config.toml`:
   - `site_url` = the production URL;
   - redirect URLs include `https://<production host>/auth/callback`;
   - minimum password length 10;
   - email confirmation: **currently off** (users are signed in right after sign-up). If you turn it on, the
     onboarding wizard needs a "check your email" step first (planned in 1D), otherwise saving the answers fails
     because there is no session yet.
3. **Seed content:** `supabase/seed.sql` does **not** run on `db push`. The hosted database needs the plans, one
   free workout (`kind = 'free'`), the starter week (`kind = 'starter'`, `starter_order` 1-5) and regular
   workouts, each with a `workout_media` row. Create the workouts in the admin panel (`/admin/workouts`) with real video
   links, or run the relevant parts of the seed SQL manually (SQL editor or `psql`). The seed's regular workouts and placeholder
   videos are demo data.
4. **Environment variables** (hosting provider): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `NEXT_PUBLIC_GOOGLE_AUTH`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   (see "Payments (Stripe)"; without the Stripe keys the plan picker is disabled and the webhook answers 503),
   optionally `ANTHROPIC_API_KEY` and `NUTRITION_AI_MODEL` (nutrition diary: without a key the "describe in words"
   estimate says it is coming soon and only manual entry works; an override model must accept the
   server-side fallback beta; list Anthropic as a processor in the privacy policy).
5. **Admin user:** after signing up, promote the owner account with the service role
   (`update public.profiles set role = 'admin' where email = '...'`).
   **Admin TOTP:** `/admin` requires a TOTP second factor, controlled by the database flag
   `public.security_flags` (`admin_mfa_required`, on by default, not editable from the app). For a **test
   project** you can let the admin in with the password only:
   `update public.security_flags set enabled = false, updated_at = now() where key = 'admin_mfa_required';`
   (the admin panel then shows a warning bar). **Before real traffic turn it back on:**
   `update public.security_flags set enabled = true, updated_at = now() where key = 'admin_mfa_required';`
6. **Legal, before any traffic:** a privacy-policy page linked from the health-data consent checkbox in the
   onboarding wizard is still required. The legal text is pending; the consent wording and the deletion/export
   flows exist, the policy page does not.
