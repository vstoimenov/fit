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

## Admin

- Promote an account (local): `node --env-file=.env.local scripts/make-admin.mjs you@example.com`.
  Hosted: `update public.profiles set role = 'admin' where email = 'you@example.com';` in the SQL editor.
- **Promote an admin and enrol TOTP immediately.** Until a TOTP factor is verified the account is protected only
  by its password. Once one factor is verified, Supabase refuses to enrol another at aal1, so a stranger who
  knows the password cannot add their own authenticator, but only if you enrol first.
- First visit to `/admin` asks for TOTP enrolment (Google Authenticator / 1Password). Every new session needs the 6-digit code.
  Without it the account is treated as a normal client everywhere (the database enforces this via `is_admin()` = role admin + aal2).
- Hosted Supabase: enable **Authentication -> Multi-factor -> TOTP** (enroll + verify), or `supabase config push`.
- Optional email for "Изпрати съобщение": `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`.
  **The sender address must be verified in Brevo**, otherwise Brevo rejects the send. Without Brevo (or with a
  rejected send) the message is recorded on the client as **NOT sent**; nothing is delivered.
- Workouts that clients completed cannot be deleted (RLS plus a restricting foreign key). "Скрий" turns them back into drafts.
- "Preview as client" needs the admin's own profile to be onboarded.

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
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `NEXT_PUBLIC_GOOGLE_AUTH`.
5. **Admin user:** after signing up, promote the owner account with the service role
   (`update public.profiles set role = 'admin' where email = '...'`).
6. **Legal, before any traffic:** a privacy-policy page linked from the health-data consent checkbox in the
   onboarding wizard is still required. The legal text is pending; the consent wording and the deletion/export
   flows exist, the policy page does not.
