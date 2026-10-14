# Fit Platform 1A — Foundation + Client App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working PWA where a woman answers the onboarding questionnaire, creates an account, does the free beginner workout, sees her personal plan, and — once she has access — follows the starter week and the dated workout feed of her level, logs progress check-ins, and manages her profile; all data protected by RLS.

**Architecture:** Next.js 16 (App Router, `src/`) talks to Supabase (Auth + Postgres) through `@supabase/ssr`. All access rules live in Postgres (RLS + `security definer` helpers); the app only renders. Pure domain logic (today's pick, streaks, video URL parsing, onboarding validation) lives in `src/lib/*` as framework-free functions with unit tests; DB services in `src/server/*` take a typed Supabase client so integration tests can drive them with a real signed-in user.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, zod 4, `@supabase/ssr` + `@supabase/supabase-js`, Supabase CLI (local Docker stack), Vitest, `motion` (animations), `canvas-confetti`, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-fit-platform-stage1-design.md`

### Where this plan sits

Stage 1 of the spec is split into four plans, executed in order. Each ends with working software:

| Plan | Contents | Spec sections |
|---|---|---|
| **1A (this)** | Scaffold, DB schema + RLS, auth, onboarding, free workout, Today/Library/Player/Plan/Profile, check-ins, data export/delete, visits, PWA | 3, 4, 5, 9 (partly), 10 (data), 11 (unit + RLS) |
| 1B | Admin panel: admin 2FA gate, calendar with bulk links, workouts, clients, activity, at-risk list + notes + Brevo message, dashboard, settings, audit log, thumbnails without video IDs | 6, 10 (2FA, audit) |
| 1C | Payments: provider interface, Stripe adapter, Revolut research + adapter, checkout/portal/webhooks, grace period, welcome page | 7, 9 |
| 1D | Tracking + consent (Pixel/CAPI, GA4/MP, Ads, GTM, Consent Mode v2, UTM capture), Turnstile, rate limiting, CSP/headers, Sentry, uptime, backups, CI, Playwright E2E, security review | 8, 10, 11 (E2E) |

## Global Constraints

- Project folder: `/Users/macbookpro/Downloads/cloude-c/fit-platform` (own git repo). Working name `fit-platform`; every user-visible brand string comes from `src/lib/brand.ts`.
- **Do not use the bg-explorer or agency-crm Supabase projects.** Local Supabase stack only; the user will create a new Supabase account/project with a company email later.
- Local Supabase ports are shifted to `553xx` (API `55321`, DB `55322`, Mailpit `55324`) so the stack can run next to AdSnap's `543xx`.
- Dev server port: `3120`.
- Machine quirks: pnpm lives in `~/.npm-global/bin` → every shell starts with `export PATH="$HOME/.npm-global/bin:$PATH"`. Supabase CLI hangs on the Docker credential helper → prefix Supabase commands with `DOCKER_CONFIG=/tmp/dockercfg` (create it once: `mkdir -p /tmp/dockercfg && echo '{}' > /tmp/dockercfg/config.json`). Use `supabase db reset` (not stop/start) to apply new migrations.
- Next.js 16: middleware file is `src/proxy.ts` exporting `proxy`; `cookies()` and page `params`/`searchParams` are Promises; a folder starting with `_` in `app/` is private.
- UI copy is Bulgarian; code, identifiers, commits are English.
- Levels: `beginner` „Начинаещ", `advanced` „Напреднал", `pro` „Профи".
- Access rule (spec §4): a workout is watchable iff it is published (`publish_at <= now()`) AND (`kind = 'free'` OR the user has active access) — or the user is admin. Active access = subscription `active`/`trialing`, or `past_due` with `grace_until > now()`, or `canceled` with `current_period_end > now()`.
- The video URL lives in `workout_media` and is readable only through the access rule above. **`workouts.thumbnail_url` must never contain a provider URL/ID** (enforced by a CHECK) — otherwise a locked video's ID leaks.
- Users can never write `role`, `starter_week_done_at`, `completed_at`, `local_date`, `visits`, `subscriptions`, `plans` (column grants + RLS).
- Email confirmation is **off** in 1A so the free workout starts right after signup (spec §5 flow). Bot/fake-signup protection arrives in 1D (Turnstile + rate limits). Flagged to the user at handoff.
- Visual rules (spec §5): no purple gradients, no icon-in-circle filler, no generic slogans. Fonts: Unbounded (display) + Manrope (body), both with Cyrillic. Tokens in `src/app/globals.css`.

## Review Focus

1. **Timezone edge:** a workout finished at 23:30 Sofia time must count for that Sofia date (not the UTC date) — pinned in Task 4 (trigger test at 21:30Z → next local day).
2. **Guessing a locked workout's ID:** a non-subscriber who opens `/app/workout/<starter-id>` or queries `workout_media` directly gets nothing, and an unpublished workout is invisible even to subscribers — pinned in Task 3 RLS tests.
3. **Canceled subscription:** access continues until `current_period_end`, then stops; `past_due` keeps access only during grace — pinned in Task 3.
4. **Double tap on „Завърших":** the second insert must not error or create a second row — pinned in Task 12 (`markWorkoutComplete` returns `already`).
5. **Real-world pasted video links:** `youtu.be/ID?si=…`, `m.youtube.com/watch?v=…&t=…`, `/shorts/`, unlisted Vimeo `vimeo.com/123/abcdef`, Bunny `/play/` — pinned in Task 5.

---

## File Structure

```
fit-platform/
├─ package.json, tsconfig.json, next.config.ts, eslint.config.mjs, .prettierrc.json
├─ vitest.config.ts              unit tests (src/**/*.test.ts)
├─ vitest.db.config.ts           integration tests (supabase/tests/**/*.test.ts)
├─ .env.example, .env.local      (local only, git-ignored)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  │  ├─ 20261014100000_foundation.sql   enums, updated_at, profiles, is_admin, bootstrap
│  │  ├─ 20261014100100_content.sql      workouts, workout_media, plans, subscriptions, access fns
│  │  └─ 20261014100200_activity.sql     workout_completions (+triggers), check_ins, visits
│  ├─ seed.sql                           plans + free + starter + regular demo workouts
│  └─ tests/ helpers.ts, profiles.test.ts, access.test.ts, activity.test.ts,
│            onboarding.test.ts, today.test.ts, completion.test.ts, profile.test.ts
├─ public/ sw.js
└─ src/
   ├─ env.ts                     parsed env (client + server)
   ├─ proxy.ts                   session refresh + optimistic redirects
   ├─ lib/
   │  ├─ env-schema.ts (+test)
   │  ├─ app-error.ts, action-result.ts, cn.ts
   │  ├─ brand.ts                every brand string/colour
   │  ├─ labels.ts               Bulgarian labels for enums
   │  ├─ auth-redirect.ts (+test)  decideAuthRedirect, safeNext
   │  ├─ device.ts (+test)       deviceFromUserAgent
   │  ├─ video/parse-video-url.ts (+test)
   │  ├─ program/types.ts, dates.ts (+test), pick-today.ts (+test), streak.ts (+test)
   │  ├─ onboarding/schema.ts (+test), plan-summary.ts (+test)
   │  └─ supabase/browser.ts, database.types.ts (generated)
   ├─ server/
   │  ├─ db/server.ts, db/admin.ts
   │  ├─ auth/require-user.ts
   │  ├─ onboarding/save-onboarding.ts
   │  ├─ content/today.ts, content/workouts.ts, content/completion.ts
   │  ├─ profile/profile.ts
   │  └─ visits/record-visit.ts
   ├─ components/
   │  ├─ ui/button.tsx, ui/field.tsx
   │  ├─ app/bottom-nav.tsx, app/visit-beacon.tsx, app/sw-register.tsx
   │  ├─ onboarding/wizard.tsx, onboarding/steps.tsx
   │  ├─ workout/workout-cover.tsx, workout/workout-card.tsx, workout/player.tsx
   │  ├─ today/week-strip.tsx, today/countdown.tsx
   │  └─ progress/sparkline.tsx
   └─ app/
      ├─ layout.tsx, globals.css, page.tsx (temporary landing), manifest.ts, offline/page.tsx
      ├─ pwa-icon/[size]/route.tsx
      ├─ login/page.tsx, forgot-password/page.tsx, reset-password/page.tsx
      ├─ auth/callback/route.ts
      ├─ start/page.tsx, start/actions.ts, start/finish/page.tsx
      ├─ app/layout.tsx, app/page.tsx (Today), app/library/page.tsx,
      │  app/workout/[id]/page.tsx, app/workout/[id]/actions.ts,
      │  app/plan/page.tsx, app/profile/page.tsx, app/profile/actions.ts,
      │  app/check-in/page.tsx, app/check-in/actions.ts
      └─ api/visit/route.ts, api/me/export/route.ts
```

---

### Task 1: Scaffold the project

**Files:**
- Create: `fit-platform/` via create-next-app, then `vitest.config.ts`, `vitest.db.config.ts`, `.prettierrc.json`, `.env.example`, `src/lib/env-schema.ts`, `src/lib/env-schema.test.ts`, `src/env.ts`, `src/lib/app-error.ts`, `src/lib/action-result.ts`, `src/lib/cn.ts`, `tests/stubs/server-only.ts`
- Modify: `package.json` (scripts), `/Users/macbookpro/Downloads/cloude-c/.claude/launch.json` (add `fit-platform-dev`)

**Interfaces:**
- Produces: `parseEnv(schema, source, scope)`, `clientEnv`, `serverEnv` (`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`), `AppError(code, userMessage)`, `isAppError(e)`, `ActionResult<T>`, `actionOk(data)`, `actionFail(error)`, `cn(...classes)`.

- [ ] **Step 1: Create the app**

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
cd /Users/macbookpro/Downloads/cloude-c
pnpm create next-app@latest fit-platform --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
cd fit-platform
pnpm add @supabase/ssr @supabase/supabase-js zod server-only motion canvas-confetti
pnpm add -D vitest supabase prettier eslint-config-prettier @types/canvas-confetti
git init 2>/dev/null; git add -A && git commit -m "chore: scaffold Next.js app"
```

Expected: `fit-platform/package.json` lists `next` 16.x.

- [ ] **Step 2: Scripts, test configs, prettier**

Replace the `scripts` block of `package.json` with:

```json
"scripts": {
  "dev": "next dev --port 3120",
  "build": "next build",
  "start": "next start --port 3120",
  "lint": "eslint . && prettier --check .",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:db": "vitest run --config vitest.db.config.ts",
  "db:start": "supabase start -x realtime,edgeruntime,logflare,vector,imgproxy,studio",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts && prettier --write src/lib/supabase/database.types.ts"
}
```

`vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
```

`vitest.db.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the local Supabase stack (`pnpm db:start`).
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
```

`tests/stubs/server-only.ts`:

```ts
export {};
```

`.prettierrc.json`:

```json
{ "printWidth": 100 }
```

Append to `eslint.config.mjs` exports array the prettier config: add `import prettier from "eslint-config-prettier";` at the top and `prettier` as the last array element.

- [ ] **Step 3: Write the failing env test**

`src/lib/env-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clientEnvSchema, parseEnv, serverEnvSchema } from "./env-schema";

describe("parseEnv", () => {
  it("returns parsed values with defaults", () => {
    const env = parseEnv(
      clientEnvSchema,
      { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" },
      "client",
    );
    expect(env.NEXT_PUBLIC_GOOGLE_AUTH).toBe("0");
  });

  it("names every missing variable in one error", () => {
    expect(() => parseEnv(serverEnvSchema, {}, "server")).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY.*APP_URL|APP_URL.*SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm test src/lib/env-schema.test.ts`
Expected: FAIL — cannot find module `./env-schema`.

- [ ] **Step 5: Implement env + shared helpers**

`src/lib/env-schema.ts`:

```ts
import { z } from "zod";

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // "1" shows the Google button; needs the Google provider configured in Supabase.
  NEXT_PUBLIC_GOOGLE_AUTH: z.enum(["0", "1"]).default("0"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/** Validates `source`; on failure throws one Error naming every bad variable. */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
  scope: "server" | "client",
): z.infer<S> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
  throw new Error(`Invalid ${scope} environment variables: ${names.join(", ")}`);
}
```

`src/env.ts`:

```ts
// Relative import: next.config.ts may load this through SWC, which breaks nested "@/" aliases.
import { clientEnvSchema, parseEnv, serverEnvSchema, type ServerEnv } from "./lib/env-schema";

// NEXT_PUBLIC_* must be referenced literally so Next.js inlines them into the client bundle.
export const clientEnv = parseEnv(
  clientEnvSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_AUTH: process.env.NEXT_PUBLIC_GOOGLE_AUTH,
  },
  "client",
);

const isServer = typeof window === "undefined";

/** Server-only variables; any access in the browser throws. */
export const serverEnv: ServerEnv = isServer
  ? parseEnv(serverEnvSchema, process.env, "server")
  : new Proxy({} as ServerEnv, {
      get(_target, property) {
        throw new Error(`serverEnv.${String(property)} was accessed in the browser.`);
      },
    });
```

`src/lib/app-error.ts`:

```ts
export type AppErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT";

/** An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly userMessage: string,
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
```

`src/lib/action-result.ts`:

```ts
import { ZodError } from "zod";
import { isAppError } from "@/lib/app-error";

/** What a server action returns to a client form. Never throws across the boundary. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(error: unknown): {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string>;
} {
  if (isAppError(error)) return { ok: false, message: error.userMessage };
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return {
      ok: false,
      message: error.issues[0]?.message ?? "Провери въведените данни.",
      fieldErrors,
    };
  }
  console.error("action failed", error instanceof Error ? error.message : error);
  return { ok: false, message: "Нещо се обърка. Опитай отново." };
}
```

`src/lib/cn.ts`:

```ts
/** Joins truthy class names. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
```

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_AUTH=0
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=http://localhost:3120
```

- [ ] **Step 6: Run the test to see it pass**

Run: `pnpm test src/lib/env-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Add the preview config**

In `/Users/macbookpro/Downloads/cloude-c/.claude/launch.json` append to `configurations`:

```json
{
  "name": "fit-platform-dev",
  "runtimeExecutable": "node",
  "runtimeArgs": ["node_modules/next/dist/bin/next", "dev", "--port", "3120"],
  "cwd": "fit-platform",
  "port": 3120
}
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: env parsing, test configs, shared helpers"
```

---

### Task 2: Local Supabase + foundation migration (profiles)

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261014100000_foundation.sql`, `supabase/tests/helpers.ts`, `supabase/tests/profiles.test.ts`, `src/lib/supabase/database.types.ts` (generated)

**Interfaces:**
- Produces (SQL): enums `user_role`, `workout_level`, `workout_kind`, `video_provider`, `subscription_status`, `payment_provider`, `feeling`, `plan_interval`; table `profiles`; `public.is_admin() → boolean`; trigger creating a profile per auth user.
- Produces (TS test helpers): `TypedClient`, `adminClient()`, `anonClient()`, `createUser(admin, label, opts?) → TestUser {id,email}`, `signedInClient(user)`, `TEST_PASSWORD`, `grantAccess(admin, userId, status?, extra?)`, `freeWorkoutId(admin)`.

- [ ] **Step 1: Init Supabase and shift ports**

```bash
mkdir -p /tmp/dockercfg && echo '{}' > /tmp/dockercfg/config.json
pnpm exec supabase init --yes
sed -i '' -E 's/^project_id = .*/project_id = "fit-platform"/; s/^port = 543([0-9]{2})$/port = 553\1/; s/^shadow_port = 54320$/shadow_port = 55320/' supabase/config.toml
sed -i '' -E 's#^site_url = .*#site_url = "http://localhost:3120"#; s#^additional_redirect_urls = .*#additional_redirect_urls = ["http://localhost:3120/auth/callback", "http://127.0.0.1:3120/auth/callback"]#; s/^minimum_password_length = .*/minimum_password_length = 10/' supabase/config.toml
grep -nE '^(project_id|port|shadow_port|site_url|additional_redirect_urls|minimum_password_length|enable_confirmations)' supabase/config.toml
```

Expected: every `port` is `553xx`; `site_url` uses 3120; `minimum_password_length = 10`; both `enable_confirmations = false` (email confirmation stays off in 1A — see Global Constraints).

- [ ] **Step 2: Write the foundation migration**

`supabase/migrations/20261014100000_foundation.sql`:

```sql
-- Enums shared across the schema.
create type public.user_role as enum ('client', 'admin');
create type public.workout_level as enum ('beginner', 'advanced', 'pro');
create type public.workout_kind as enum ('free', 'starter', 'regular');
create type public.video_provider as enum ('youtube', 'vimeo', 'bunny');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'none');
create type public.payment_provider as enum ('stripe', 'revolut', 'manual');
create type public.feeling as enum ('easy', 'right', 'hard');
create type public.plan_interval as enum ('month', 'year');

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '' check (char_length(name) <= 60),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{8,16}$'),
  phone_call_consent boolean not null default false,
  health_data_consent_at timestamptz,
  marketing_consent boolean not null default false,
  role public.user_role not null default 'client',
  level public.workout_level not null default 'beginner',
  height_cm smallint check (height_cm between 120 and 230),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 250),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 30 and 250),
  goal text check (goal in ('lose_weight', 'tone', 'strength', 'energy')),
  problems text[] not null default '{}',
  time_per_session text check (time_per_session in ('15', '20-30', '40+')),
  onboarding_done boolean not null default false,
  starter_week_done_at timestamptz,
  timezone text not null default 'Europe/Sofia' check (char_length(timezone) <= 64),
  first_utm jsonb,
  fbclid text,
  gclid text,
  last_seen_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- security definer: policies on profiles call this without recursing into RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke execute on function public.is_admin() from public;
-- anon too: the plans policy calls it for signed-out visitors (returns false for them).
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Users may only change these columns; role, starter progress, attribution stay server-side.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  name, phone, phone_call_consent, marketing_consent, health_data_consent_at, level,
  height_cm, weight_kg, target_weight_kg, goal, problems, time_per_session, timezone,
  onboarding_done
) on public.profiles to authenticated;

-- One profile per auth user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''), 60)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Start the stack and generate types**

```bash
export DOCKER_CONFIG=/tmp/dockercfg
pnpm db:start
pnpm db:reset
mkdir -p src/lib/supabase && pnpm db:types
pnpm exec supabase status -o json | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(`NEXT_PUBLIC_SUPABASE_URL=${s.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${s.ANON_KEY}\nNEXT_PUBLIC_GOOGLE_AUTH=0\nSUPABASE_SERVICE_ROLE_KEY=${s.SERVICE_ROLE_KEY}\nAPP_URL=http://localhost:3120`)' > .env.local
```

Expected: `db reset` prints `Finished supabase db reset`; `database.types.ts` contains `profiles`; `.env.local` has five lines with values.

- [ ] **Step 4: Test helpers**

`supabase/tests/helpers.ts`:

```ts
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type TypedClient = SupabaseClient<Database>;

interface LocalKeys {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

let cachedKeys: LocalKeys | undefined;

/** Keys of the stack under test: env vars in CI, `supabase status` locally. */
export function localKeys(): LocalKeys {
  if (cachedKeys) return cachedKeys;
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
    cachedKeys = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY };
    return cachedKeys;
  }
  const raw = execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/tmp/dockercfg" },
  });
  const status = JSON.parse(raw) as Record<string, string | undefined>;
  if (!status.API_URL || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error("supabase status returned no keys. Is `pnpm db:start` running?");
  }
  cachedKeys = { url: status.API_URL, anonKey: status.ANON_KEY, serviceRoleKey: status.SERVICE_ROLE_KEY };
  return cachedKeys;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): TypedClient {
  const { url, serviceRoleKey } = localKeys();
  return createClient<Database>(url, serviceRoleKey, noSession);
}

export function anonClient(): TypedClient {
  const { url, anonKey } = localKeys();
  return createClient<Database>(url, anonKey, noSession);
}

export const TEST_PASSWORD = "test-password-123";

export interface TestUser {
  id: string;
  email: string;
}

export async function createUser(
  admin: TypedClient,
  label: string,
  opts: { name?: string } = {},
): Promise<TestUser> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: opts.name ? { name: opts.name } : undefined,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return { id: data.user.id, email };
}

export async function signedInClient(user: TestUser): Promise<TypedClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: TEST_PASSWORD });
  if (error) throw error;
  return client;
}
```

(`grantAccess` and `freeWorkoutId` are added in Task 3, once their tables exist.)

- [ ] **Step 5: Write the failing profile tests**

`supabase/tests/profiles.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createUser, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("profiles", () => {
  it("creates a profile with the signup name for every new user", async () => {
    const user = await createUser(admin, "boot", { name: "Мария" });
    const { data } = await admin.from("profiles").select("name, role, level").eq("id", user.id).single();
    expect(data).toEqual({ name: "Мария", role: "client", level: "beginner" });
  });

  it("lets a user read and edit only her own profile", async () => {
    const a = await createUser(admin, "own-a");
    const b = await createUser(admin, "own-b");
    const db = await signedInClient(a);

    const { data: rows } = await db.from("profiles").select("id");
    expect(rows?.map((r) => r.id)).toEqual([a.id]);

    const { error } = await db.from("profiles").update({ name: "Ани" }).eq("id", a.id);
    expect(error).toBeNull();

    await db.from("profiles").update({ name: "hack" }).eq("id", b.id);
    const { data: other } = await admin.from("profiles").select("name").eq("id", b.id).single();
    expect(other?.name).toBe("");
  });

  it("refuses role escalation and server-only columns", async () => {
    const user = await createUser(admin, "esc");
    const db = await signedInClient(user);
    const { error: roleError } = await db.from("profiles").update({ role: "admin" }).eq("id", user.id);
    expect(roleError?.code).toBe("42501");
    const { error: starterError } = await db
      .from("profiles")
      .update({ starter_week_done_at: new Date().toISOString() })
      .eq("id", user.id);
    expect(starterError?.code).toBe("42501");
  });

  it("hides profiles from anonymous visitors", async () => {
    const { data } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("lets an admin read every profile", async () => {
    const boss = await createUser(admin, "boss");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    const other = await createUser(admin, "seen");
    const db = await signedInClient(boss);
    const { data } = await db.from("profiles").select("id").eq("id", other.id);
    expect(data).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/profiles.test.ts`
Expected: PASS (5 tests). If the migration from Step 2 was skipped, the bootstrap test fails with a missing profile — that is the RED proof that the trigger carries the behaviour; re-run `pnpm db:reset` after fixing.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(db): profiles with RLS, column grants and signup bootstrap"
```

---

### Task 3: Content schema — workouts, media, plans, subscriptions, access rules

**Files:**
- Create: `supabase/migrations/20261014100100_content.sql`, `supabase/seed.sql`, `supabase/tests/access.test.ts`
- Modify: `supabase/tests/helpers.ts` (add `grantAccess`, `freeWorkoutId`, `createWorkout`), `src/lib/supabase/database.types.ts` (regenerate)

**Interfaces:**
- Consumes: Task 2 enums, `profiles`, `is_admin()`.
- Produces (SQL): tables `workouts`, `workout_media`, `plans`, `subscriptions`; functions `has_active_access(uid uuid)` (service-only), `can_watch(p_workout_id uuid) → boolean`, `my_access() → boolean`, `next_drop_at(p_level workout_level) → timestamptz`.
- Produces (TS helpers): `grantAccess(admin, userId, status = "active", extra = {})`, `freeWorkoutId(admin) → Promise<string>`, `createWorkout(admin, fields) → Promise<string>` (inserts workout + media).

- [ ] **Step 1: Write the migration**

`supabase/migrations/20261014100100_content.sql`:

```sql
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  kind public.workout_kind not null default 'regular',
  level public.workout_level,
  duration_min smallint not null check (duration_min between 1 and 180),
  focus text[] not null default '{}',
  -- Our own image only: a provider thumbnail URL carries the video ID and would leak it.
  thumbnail_url text check (
    thumbnail_url is null
    or thumbnail_url !~* '(ytimg|youtube|youtu\.be|vimeo|mediadelivery|b-cdn)'
  ),
  starter_order smallint,
  publish_at timestamptz,
  notify boolean not null default true,
  notified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_level_rule check ((kind = 'regular') = (level is not null)),
  constraint workouts_starter_rule check ((kind = 'starter') = (starter_order is not null))
);

create unique index workouts_single_free on public.workouts (kind) where kind = 'free';
create unique index workouts_starter_order on public.workouts (starter_order) where kind = 'starter';
create index workouts_level_publish on public.workouts (level, publish_at desc);

create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

-- Video URLs live apart from metadata so RLS can hide them from users without access.
create table public.workout_media (
  workout_id uuid primary key references public.workouts (id) on delete cascade,
  provider public.video_provider not null,
  video_url text not null check (char_length(video_url) <= 500)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  interval public.plan_interval not null,
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  provider_price_ids jsonb not null default '{}',
  active boolean not null default true,
  sort smallint not null default 0
);

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  provider public.payment_provider not null,
  provider_customer_id text,
  provider_sub_id text,
  status public.subscription_status not null default 'none',
  current_period_end timestamptz,
  grace_until timestamptz,
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Service-only: tells whether a given user may watch paid content right now.
create function public.has_active_access(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and (
        s.status in ('active', 'trialing')
        or (s.status = 'past_due' and s.grace_until > now())
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  );
$$;
revoke execute on function public.has_active_access(uuid) from public, anon, authenticated;

create function public.can_watch(p_workout_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workouts w
    where w.id = p_workout_id
      and (
        public.is_admin()
        or (
          w.publish_at is not null and w.publish_at <= now()
          and (w.kind = 'free' or public.has_active_access((select auth.uid())))
        )
      )
  );
$$;
revoke execute on function public.can_watch(uuid) from public, anon;
grant execute on function public.can_watch(uuid) to authenticated;

create function public.my_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_active_access((select auth.uid()));
$$;
revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- Countdown on the Today screen: when the next workout of a level goes live (time only, no content).
create function public.next_drop_at(p_level public.workout_level) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select min(publish_at) from public.workouts
  where kind = 'regular' and level = p_level and publish_at > now();
$$;
revoke execute on function public.next_drop_at(public.workout_level) from public, anon;
grant execute on function public.next_drop_at(public.workout_level) to authenticated;

alter table public.workouts enable row level security;
alter table public.workout_media enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

create policy workouts_select on public.workouts for select to authenticated
  using ((select public.is_admin()) or (publish_at is not null and publish_at <= now()));

create policy workout_media_select on public.workout_media for select to authenticated
  using (public.can_watch(workout_id));

create policy plans_select on public.plans for select to anon, authenticated
  using (active or (select public.is_admin()));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Writes come from the service role (seed, admin panel in 1B, webhooks in 1C).
revoke insert, update, delete on public.workouts, public.workout_media, public.plans, public.subscriptions
  from anon, authenticated;
```

- [ ] **Step 2: Write the seed**

`supabase/seed.sql`:

```sql
-- Demo content for local work. Video links are placeholders the admin replaces.
insert into public.plans (name, interval, price_cents, sort) values
  ('Месечен', 'month', 1990, 1),
  ('Годишен', 'year', 14900, 2);

with w as (
  insert into public.workouts (title, description, kind, level, duration_min, focus, starter_order, publish_at)
  values
    ('Първа тренировка: цяло тяло', 'Лека тренировка за начало. Без скачане.', 'free', null, 20, '{full_body}', null, now() - interval '30 days'),
    ('Старт 1: Събуди тялото', 'Мобилност и дишане.', 'starter', null, 15, '{stretch}', 1, now() - interval '30 days'),
    ('Старт 2: Стабилен корем', 'Основа за всичко останало.', 'starter', null, 20, '{core}', 2, now() - interval '30 days'),
    ('Старт 3: Дупе и крака', 'Без клекове с тежест.', 'starter', null, 20, '{glutes_legs}', 3, now() - interval '30 days'),
    ('Старт 4: Горна част', 'Ръце, гръб, стойка.', 'starter', null, 20, '{upper}', 4, now() - interval '30 days'),
    ('Старт 5: Цяло тяло', 'Събираме всичко.', 'starter', null, 25, '{full_body}', 5, now() - interval '30 days'),
    ('Корем без болки в кръста', '', 'regular', 'beginner', 25, '{core}', null, now() - interval '4 days'),
    ('Стегнато дупе у дома', '', 'regular', 'beginner', 25, '{glutes_legs}', null, now() - interval '2 days'),
    ('Цяло тяло за 20 минути', '', 'regular', 'beginner', 20, '{full_body}', null, now() + interval '2 days'),
    ('Интервали с ластик', '', 'regular', 'advanced', 30, '{cardio,full_body}', null, now() - interval '3 days'),
    ('Силна горна част', '', 'regular', 'advanced', 30, '{upper}', null, now() + interval '1 day'),
    ('Профи HIIT 40', '', 'regular', 'pro', 40, '{cardio}', null, now() - interval '1 day'),
    ('Профи сила: крака', '', 'regular', 'pro', 40, '{glutes_legs}', null, now() + interval '3 days')
  returning id
)
insert into public.workout_media (workout_id, provider, video_url)
select id, 'youtube', 'https://www.youtube.com/watch?v=ml6cT4AZdqI' from w;
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm db:reset && pnpm db:types`
Expected: reset finishes, seed applied without errors; types now include `workouts`, `workout_media`, `plans`, `subscriptions`, functions `can_watch`, `my_access`, `next_drop_at`.

- [ ] **Step 3: Extend the test helpers**

Append to `supabase/tests/helpers.ts` (it already imports `Database`):

```ts
type SubStatus = Database["public"]["Enums"]["subscription_status"];
type WorkoutInsert = Database["public"]["Tables"]["workouts"]["Insert"];

/** Gives a user a subscription row (default: active, manual). */
export async function grantAccess(
  admin: TypedClient,
  userId: string,
  status: SubStatus = "active",
  extra: { current_period_end?: string | null; grace_until?: string | null } = {},
): Promise<void> {
  const { error } = await admin
    .from("subscriptions")
    .upsert({ user_id: userId, provider: "manual", status, ...extra });
  if (error) throw error;
}

export async function freeWorkoutId(admin: TypedClient): Promise<string> {
  const { data, error } = await admin.from("workouts").select("id").eq("kind", "free").single();
  if (error || !data) throw error ?? new Error("seed has no free workout — run pnpm db:reset");
  return data.id;
}

/** Inserts a workout plus a YouTube media row; returns its id. */
export async function createWorkout(admin: TypedClient, fields: WorkoutInsert): Promise<string> {
  const { data, error } = await admin.from("workouts").insert(fields).select("id").single();
  if (error || !data) throw error ?? new Error("createWorkout failed");
  const media = await admin
    .from("workout_media")
    .insert({ workout_id: data.id, provider: "youtube", video_url: "https://youtu.be/ml6cT4AZdqI" });
  if (media.error) throw media.error;
  return data.id;
}
```

- [ ] **Step 4: Write the access tests**

`supabase/tests/access.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let paidId: string;
let futureId: string;
let freeId: string;

const day = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

beforeAll(async () => {
  admin = adminClient();
  freeId = await freeWorkoutId(admin);
  paidId = await createWorkout(admin, {
    title: "Платена", kind: "regular", level: "beginner", duration_min: 20, publish_at: iso(-day),
  });
  futureId = await createWorkout(admin, {
    title: "Бъдеща", kind: "regular", level: "beginner", duration_min: 20, publish_at: iso(day),
  });
});

async function mediaVisible(db: TypedClient, workoutId: string): Promise<boolean> {
  const { data } = await db.from("workout_media").select("video_url").eq("workout_id", workoutId);
  return (data ?? []).length === 1;
}

describe("content access", () => {
  it("shows a non-subscriber the free video only", async () => {
    const db = await signedInClient(await createUser(admin, "nosub"));
    expect(await mediaVisible(db, freeId)).toBe(true);
    expect(await mediaVisible(db, paidId)).toBe(false);
    const { data: access } = await db.rpc("my_access");
    expect(access).toBe(false);
  });

  it("lists published workout metadata but never unpublished ones", async () => {
    const db = await signedInClient(await createUser(admin, "meta"));
    const { data } = await db.from("workouts").select("id").in("id", [paidId, futureId]);
    expect(data?.map((r) => r.id)).toEqual([paidId]);
  });

  it("hides an unpublished workout's video even from a subscriber", async () => {
    const user = await createUser(admin, "sub-future");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    expect(await mediaVisible(db, paidId)).toBe(true);
    expect(await mediaVisible(db, futureId)).toBe(false);
  });

  it("keeps access after cancel until the period ends", async () => {
    const live = await createUser(admin, "cancel-live");
    await grantAccess(admin, live.id, "canceled", { current_period_end: iso(3 * day) });
    expect(await mediaVisible(await signedInClient(live), paidId)).toBe(true);

    const ended = await createUser(admin, "cancel-ended");
    await grantAccess(admin, ended.id, "canceled", { current_period_end: iso(-day) });
    expect(await mediaVisible(await signedInClient(ended), paidId)).toBe(false);
  });

  it("keeps past_due access only during grace", async () => {
    const inGrace = await createUser(admin, "grace-in");
    await grantAccess(admin, inGrace.id, "past_due", { grace_until: iso(day) });
    expect(await mediaVisible(await signedInClient(inGrace), paidId)).toBe(true);

    const expired = await createUser(admin, "grace-out");
    await grantAccess(admin, expired.id, "past_due", { grace_until: iso(-day) });
    expect(await mediaVisible(await signedInClient(expired), paidId)).toBe(false);
  });

  it("refuses direct calls to the service-only access check", async () => {
    const db = await signedInClient(await createUser(admin, "rpc"));
    const { error } = await db.rpc("has_active_access", { uid: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });

  it("reveals only the time of the next drop", async () => {
    const db = await signedInClient(await createUser(admin, "drop"));
    const { data } = await db.rpc("next_drop_at", { p_level: "beginner" });
    expect(data).not.toBeNull();
    expect(Date.parse(data as string)).toBeGreaterThan(Date.now());
  });

  it("rejects provider thumbnails that would leak the video ID", async () => {
    const { error } = await admin
      .from("workouts")
      .update({ thumbnail_url: "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg" })
      .eq("id", paidId);
    expect(error?.code).toBe("23514");
  });

  it("lets no client write content", async () => {
    const db = await signedInClient(await createUser(admin, "writer"));
    const { error } = await db
      .from("workouts")
      .insert({ title: "x", kind: "regular", level: "pro", duration_min: 5 });
    expect(error?.code).toBe("42501");
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/access.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(db): workouts, hidden media, plans, subscriptions and access rules"
```

---

### Task 4: Activity schema — completions, check-ins, visits

**Files:**
- Create: `supabase/migrations/20261014100200_activity.sql`, `supabase/tests/activity.test.ts`
- Modify: `src/lib/supabase/database.types.ts` (regenerate)

**Interfaces:**
- Consumes: `workouts`, `profiles`, `can_watch`, `is_admin`.
- Produces (SQL): `workout_completions(id, user_id, workout_id, completed_at, local_date, feeling)` with `local_date` computed from the user's timezone and unique `(user_id, workout_id, local_date)`; trigger setting `profiles.starter_week_done_at` when all published starters are done; `check_ins`; `visits`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20261014100200_activity.sql`:

```sql
create table public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  completed_at timestamptz not null default now(),
  -- Placeholder default keeps the column optional in generated Insert types; the trigger below always overwrites it.
  local_date date not null default current_date,
  feeling public.feeling,
  unique (user_id, workout_id, local_date)
);
create index workout_completions_user_date on public.workout_completions (user_id, local_date desc);

-- local_date is the calendar day in the user's own timezone; never trusted from the client.
create function public.completion_local_date() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select (new.completed_at at time zone p.timezone)::date into new.local_date
  from public.profiles p where p.id = new.user_id;
  if new.local_date is null then
    new.local_date := (new.completed_at at time zone 'Europe/Sofia')::date;
  end if;
  return new;
end $$;

create trigger workout_completions_local_date before insert on public.workout_completions
  for each row execute function public.completion_local_date();

-- Finishing the last published starter workout ends the starter week.
create function public.mark_starter_week_done() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total int;
  done int;
begin
  if (select kind from public.workouts where id = new.workout_id) <> 'starter' then
    return new;
  end if;
  select count(*) into total from public.workouts
    where kind = 'starter' and publish_at is not null and publish_at <= now();
  select count(distinct c.workout_id) into done
    from public.workout_completions c join public.workouts w on w.id = c.workout_id
    where c.user_id = new.user_id and w.kind = 'starter';
  if total > 0 and done >= total then
    update public.profiles set starter_week_done_at = coalesce(starter_week_done_at, now())
      where id = new.user_id;
  end if;
  return new;
end $$;

create trigger workout_completions_starter after insert on public.workout_completions
  for each row execute function public.mark_starter_week_done();

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 250),
  waist_cm numeric(5, 1) check (waist_cm between 40 and 200),
  hips_cm numeric(5, 1) check (hips_cm between 50 and 220),
  energy smallint check (energy between 1 and 5),
  mood smallint check (mood between 1 and 5),
  note text check (char_length(note) <= 500),
  constraint check_ins_not_empty check (
    coalesce(weight_kg, waist_cm, hips_cm, energy, mood) is not null or note is not null
  )
);
create index check_ins_user_created on public.check_ins (user_id, created_at desc);

create table public.visits (
  id bigint generated always as identity primary key,
  anon_id uuid not null,
  user_id uuid references public.profiles (id) on delete set null,
  path text not null check (char_length(path) <= 300),
  referrer text check (char_length(referrer) <= 500),
  utm jsonb,
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  created_at timestamptz not null default now()
);
create index visits_created on public.visits (created_at desc);
create index visits_user on public.visits (user_id, created_at desc);

alter table public.workout_completions enable row level security;
alter table public.check_ins enable row level security;
alter table public.visits enable row level security;

create policy completions_select on public.workout_completions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy completions_insert on public.workout_completions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_watch(workout_id));
create policy completions_update on public.workout_completions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy check_ins_select on public.check_ins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy check_ins_insert on public.check_ins for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy check_ins_delete on public.check_ins for delete to authenticated
  using (user_id = (select auth.uid()));

create policy visits_select on public.visits for select to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.workout_completions, public.check_ins, public.visits
  from anon, authenticated;
grant insert (workout_id, feeling) on public.workout_completions to authenticated;
grant update (feeling) on public.workout_completions to authenticated;
grant insert (weight_kg, waist_cm, hips_cm, energy, mood, note) on public.check_ins to authenticated;
grant delete on public.check_ins to authenticated;
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm db:reset && pnpm db:types`
Expected: reset succeeds; types include the three tables.

- [ ] **Step 2: Write the activity tests**

`supabase/tests/activity.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createUser,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let freeId: string;

beforeAll(async () => {
  admin = adminClient();
  freeId = await freeWorkoutId(admin);
});

describe("workout_completions", () => {
  it("dates a completion by the user's local day, not UTC", async () => {
    const user = await createUser(admin, "tz");
    // 21:30 UTC on 14 Oct = 00:30 on 15 Oct in Sofia (UTC+3, summer time).
    const { data, error } = await admin
      .from("workout_completions")
      .insert({ user_id: user.id, workout_id: freeId, completed_at: "2026-10-14T21:30:00Z", local_date: "2000-01-01" })
      .select("local_date")
      .single();
    expect(error).toBeNull();
    expect(data?.local_date).toBe("2026-10-15");
  });

  it("lets a user complete the free workout but not a locked one", async () => {
    const user = await createUser(admin, "lock");
    const db = await signedInClient(user);
    const ok = await db.from("workout_completions").insert({ workout_id: freeId });
    expect(ok.error).toBeNull();

    const { data: paid } = await admin
      .from("workouts").select("id").eq("kind", "regular").lte("publish_at", new Date().toISOString()).limit(1).single();
    const denied = await db.from("workout_completions").insert({ workout_id: paid!.id });
    expect(denied.error?.code).toBe("42501");
  });

  it("refuses a second completion of the same workout on the same day", async () => {
    const db = await signedInClient(await createUser(admin, "dup"));
    await db.from("workout_completions").insert({ workout_id: freeId });
    const again = await db.from("workout_completions").insert({ workout_id: freeId });
    expect(again.error?.code).toBe("23505");
  });

  it("refuses a backdated completion from the client", async () => {
    const db = await signedInClient(await createUser(admin, "back"));
    const { error } = await db
      .from("workout_completions")
      .insert({ workout_id: freeId, completed_at: "2020-01-01T00:00:00Z" });
    expect(error?.code).toBe("42501");
  });

  it("ends the starter week after the last published starter", async () => {
    const user = await createUser(admin, "starter");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    const { data: starters } = await admin.from("workouts").select("id").eq("kind", "starter").order("starter_order");
    for (const [index, s] of (starters ?? []).entries()) {
      const { data: before } = await admin.from("profiles").select("starter_week_done_at").eq("id", user.id).single();
      expect(before?.starter_week_done_at).toBeNull();
      const { error } = await db.from("workout_completions").insert({ workout_id: s.id });
      expect(error, `starter #${index + 1}`).toBeNull();
    }
    const { data: after } = await admin.from("profiles").select("starter_week_done_at").eq("id", user.id).single();
    expect(after?.starter_week_done_at).not.toBeNull();
  });
});

describe("check_ins", () => {
  it("stores a user's own check-in and hides it from others", async () => {
    const a = await createUser(admin, "ci-a");
    const b = await createUser(admin, "ci-b");
    const dbA = await signedInClient(a);
    const { error } = await dbA.from("check_ins").insert({ weight_kg: 64.5, energy: 4 });
    expect(error).toBeNull();
    const { data: seenByB } = await (await signedInClient(b)).from("check_ins").select("id").eq("user_id", a.id);
    expect(seenByB).toEqual([]);
  });

  it("rejects an empty check-in", async () => {
    const db = await signedInClient(await createUser(admin, "ci-empty"));
    const { error } = await db.from("check_ins").insert({});
    expect(error?.code).toBe("23514");
  });
});

describe("visits", () => {
  it("is invisible and unwritable for clients", async () => {
    const db = await signedInClient(await createUser(admin, "visit"));
    const write = await db
      .from("visits")
      .insert({ anon_id: crypto.randomUUID(), path: "/", device: "mobile" });
    expect(write.error?.code).toBe("42501");
    const { data } = await db.from("visits").select("id");
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/activity.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): completions with local dates, starter week trigger, check-ins, visits"
```

---

### Task 5: Video URL parsing

**Files:**
- Create: `src/lib/video/parse-video-url.ts`, `src/lib/video/parse-video-url.test.ts`

**Interfaces:**
- Produces: `type VideoProvider = "youtube" | "vimeo" | "bunny"`; `interface VideoRef { provider: VideoProvider; id: string; embedUrl: string }`; `parseVideoUrl(raw: string): VideoRef | null`.

- [ ] **Step 1: Write the failing tests**

`src/lib/video/parse-video-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./parse-video-url";

const yt = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;

describe("parseVideoUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=ml6cT4AZdqI", "ml6cT4AZdqI"],
    ["https://youtube.com/watch?v=ml6cT4AZdqI&t=42s", "ml6cT4AZdqI"],
    ["https://m.youtube.com/watch?v=ml6cT4AZdqI&feature=share", "ml6cT4AZdqI"],
    ["https://youtu.be/ml6cT4AZdqI?si=AbCdEf123", "ml6cT4AZdqI"],
    ["https://www.youtube.com/shorts/ml6cT4AZdqI", "ml6cT4AZdqI"],
    ["https://www.youtube.com/embed/ml6cT4AZdqI", "ml6cT4AZdqI"],
    ["https://www.youtube.com/live/ml6cT4AZdqI?feature=shared", "ml6cT4AZdqI"],
    ["  https://youtu.be/ml6cT4AZdqI  ", "ml6cT4AZdqI"],
  ])("reads YouTube link %s", (url, id) => {
    expect(parseVideoUrl(url)).toEqual({ provider: "youtube", id, embedUrl: yt(id) });
  });

  it("reads a public and an unlisted Vimeo link", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({
      provider: "vimeo",
      id: "76979871",
      embedUrl: "https://player.vimeo.com/video/76979871?dnt=1",
    });
    expect(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")?.embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1&h=8272103f6e",
    );
    expect(parseVideoUrl("https://player.vimeo.com/video/76979871?h=8272103f6e")?.embedUrl).toBe(
      "https://player.vimeo.com/video/76979871?dnt=1&h=8272103f6e",
    );
  });

  it("reads Bunny embed and play links", () => {
    const guid = "0c1f6d0e-7c2a-4d8e-9a55-2f8a6b1e9c11";
    const expected = {
      provider: "bunny",
      id: `123456/${guid}`,
      embedUrl: `https://iframe.mediadelivery.net/embed/123456/${guid}?responsive=true`,
    };
    expect(parseVideoUrl(`https://iframe.mediadelivery.net/embed/123456/${guid}`)).toEqual(expected);
    expect(parseVideoUrl(`https://iframe.mediadelivery.net/play/123456/${guid}`)).toEqual(expected);
    expect(parseVideoUrl(`https://player.mediadelivery.net/embed/123456/${guid}?autoplay=true`)).toEqual(expected);
  });

  it.each([
    "",
    "not a url",
    "https://example.com/watch?v=ml6cT4AZdqI",
    "https://www.youtube.com/watch?v=short",
    "javascript:alert(1)",
    "https://vimeo.com/channels/staffpicks",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm test src/lib/video`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/video/parse-video-url.ts`:

```ts
export type VideoProvider = "youtube" | "vimeo" | "bunny";

export interface VideoRef {
  provider: VideoProvider;
  id: string;
  embedUrl: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const BUNNY_HOSTS = new Set(["iframe.mediadelivery.net", "player.mediadelivery.net"]);

function youtube(id: string): VideoRef | null {
  if (!YT_ID.test(id)) return null;
  return {
    provider: "youtube",
    id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
  };
}

/** Turns any common YouTube / Vimeo / Bunny link into an embeddable reference, or null. */
export function parseVideoUrl(raw: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return parts[0] ? youtube(parts[0]) : null;

  if (YT_HOSTS.has(host)) {
    if (parts[0] === "watch") return youtube(url.searchParams.get("v") ?? "");
    if (["shorts", "embed", "live"].includes(parts[0] ?? "") && parts[1]) return youtube(parts[1]);
    return null;
  }

  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const videoParts = host === "player.vimeo.com" ? parts.slice(parts[0] === "video" ? 1 : 0) : parts;
    const id = videoParts[0];
    if (!id || !/^\d+$/.test(id)) return null;
    const hash = videoParts[1] ?? url.searchParams.get("h");
    const query = hash && /^[A-Za-z0-9]+$/.test(hash) ? `?dnt=1&h=${hash}` : "?dnt=1";
    return { provider: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}${query}` };
  }

  if (BUNNY_HOSTS.has(host)) {
    const [mode, library, guid] = parts;
    if ((mode !== "embed" && mode !== "play") || !library || !guid) return null;
    if (!/^\d+$/.test(library) || !/^[0-9a-f-]{36}$/i.test(guid)) return null;
    return {
      provider: "bunny",
      id: `${library}/${guid}`,
      embedUrl: `https://iframe.mediadelivery.net/embed/${library}/${guid}?responsive=true`,
    };
  }

  return null;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test src/lib/video`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: parse YouTube, Vimeo and Bunny links into embeds"
```

---

### Task 6: Program logic — local dates, today's pick, streak, week strip

**Files:**
- Create: `src/lib/program/types.ts`, `src/lib/program/dates.ts`, `src/lib/program/dates.test.ts`, `src/lib/program/pick-today.ts`, `src/lib/program/pick-today.test.ts`, `src/lib/program/streak.ts`, `src/lib/program/streak.test.ts`

**Interfaces:**
- Produces:
  - `type Level = "beginner" | "advanced" | "pro"`, `type WorkoutKind = "free" | "starter" | "regular"`
  - `interface WorkoutLite { id: string; kind: WorkoutKind; level: Level | null; starterOrder: number | null; publishAt: string | null }`
  - `toLocalDate(at: Date | string, timeZone: string): string` (`YYYY-MM-DD`)
  - `interface WeekDay { date: string; label: string; isToday: boolean; done: boolean; slot: boolean }`; `weekStrip(today: string, completionDates: string[], slotDates: string[]): WeekDay[]` (Monday-first)
  - `isPublished(w: WorkoutLite, now: Date): boolean`
  - `type TodayPick = { kind: "free"; workoutId: string } | { kind: "starter"; workoutId: string; index: number; total: number } | { kind: "regular"; workoutId: string } | { kind: "rest" } | { kind: "locked" }`
  - `pickToday(input: { level: Level; hasAccess: boolean; starterWeekDone: boolean; now: Date; workouts: WorkoutLite[]; completedIds: ReadonlySet<string> }): TodayPick`
  - `computeStreak(input: { slotDates: string[]; completionDates: string[]; today: string }): number`

- [ ] **Step 1: Types**

`src/lib/program/types.ts`:

```ts
export type Level = "beginner" | "advanced" | "pro";
export type WorkoutKind = "free" | "starter" | "regular";

/** The fields program logic needs; dates are ISO strings. */
export interface WorkoutLite {
  id: string;
  kind: WorkoutKind;
  level: Level | null;
  starterOrder: number | null;
  publishAt: string | null;
}
```

- [ ] **Step 2: Write the failing tests**

`src/lib/program/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toLocalDate, weekStrip } from "./dates";

describe("toLocalDate", () => {
  it("uses the given timezone, not UTC", () => {
    expect(toLocalDate("2026-10-14T21:30:00Z", "Europe/Sofia")).toBe("2026-10-15");
    expect(toLocalDate("2026-10-14T21:30:00Z", "UTC")).toBe("2026-10-14");
  });
});

describe("weekStrip", () => {
  it("returns Monday..Sunday around today with done and slot flags", () => {
    // 2026-10-14 is a Wednesday.
    const week = weekStrip("2026-10-14", ["2026-10-12", "2026-10-14"], ["2026-10-13", "2026-10-15"]);
    expect(week.map((d) => d.date)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
    expect(week.map((d) => d.label)).toEqual(["П", "В", "С", "Ч", "П", "С", "Н"]);
    expect(week[2]).toMatchObject({ isToday: true, done: true, slot: false });
    expect(week[1]).toMatchObject({ done: false, slot: true });
  });

  it("handles a Sunday as the last day of its week", () => {
    expect(weekStrip("2026-10-18", [], [])[6]).toMatchObject({ date: "2026-10-18", isToday: true });
  });
});
```

`src/lib/program/pick-today.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickToday } from "./pick-today";
import type { WorkoutLite } from "./types";

const now = new Date("2026-10-14T10:00:00Z");
const past = "2026-10-01T07:00:00Z";
const w = (over: Partial<WorkoutLite> & Pick<WorkoutLite, "id">): WorkoutLite => ({
  kind: "regular", level: "beginner", starterOrder: null, publishAt: past, ...over,
});

const catalog: WorkoutLite[] = [
  w({ id: "free", kind: "free", level: null }),
  w({ id: "s2", kind: "starter", level: null, starterOrder: 2 }),
  w({ id: "s1", kind: "starter", level: null, starterOrder: 1 }),
  w({ id: "old", publishAt: "2026-10-08T07:00:00Z" }),
  w({ id: "new", publishAt: "2026-10-13T07:00:00Z" }),
  w({ id: "future", publishAt: "2026-10-20T07:00:00Z" }),
  w({ id: "pro", level: "pro", publishAt: "2026-10-14T07:00:00Z" }),
];

const base = { level: "beginner" as const, hasAccess: true, starterWeekDone: true, now, workouts: catalog };

describe("pickToday", () => {
  it("offers the free workout to a user without access", () => {
    expect(pickToday({ ...base, hasAccess: false, completedIds: new Set() })).toEqual({ kind: "free", workoutId: "free" });
  });

  it("locks a user without access once the free workout is done", () => {
    expect(pickToday({ ...base, hasAccess: false, completedIds: new Set(["free"]) })).toEqual({ kind: "locked" });
  });

  it("walks the starter week in order", () => {
    const input = { ...base, starterWeekDone: false };
    expect(pickToday({ ...input, completedIds: new Set() })).toEqual({ kind: "starter", workoutId: "s1", index: 1, total: 2 });
    expect(pickToday({ ...input, completedIds: new Set(["s1"]) })).toEqual({ kind: "starter", workoutId: "s2", index: 2, total: 2 });
  });

  it("moves to the newest unfinished workout of the user's level", () => {
    expect(pickToday({ ...base, completedIds: new Set() })).toEqual({ kind: "regular", workoutId: "new" });
    expect(pickToday({ ...base, completedIds: new Set(["new"]) })).toEqual({ kind: "regular", workoutId: "old" });
  });

  it("ignores unpublished workouts and other levels", () => {
    const pick = pickToday({ ...base, completedIds: new Set(["new", "old"]) });
    expect(pick).toEqual({ kind: "rest" });
  });

  it("falls through to regular workouts when every starter is done but the flag lags", () => {
    expect(pickToday({ ...base, starterWeekDone: false, completedIds: new Set(["s1", "s2"]) })).toEqual({
      kind: "regular",
      workoutId: "new",
    });
  });
});
```

`src/lib/program/streak.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

const slots = ["2026-10-07", "2026-10-09", "2026-10-11", "2026-10-14"];

describe("computeStreak", () => {
  it("is 0 with no slots", () => {
    expect(computeStreak({ slotDates: [], completionDates: ["2026-10-14"], today: "2026-10-14" })).toBe(0);
  });

  it("counts consecutive slots done, each until the next slot opens", () => {
    // 09 done on 10th (still before slot 11), 11 done same day, 14 done today.
    expect(
      computeStreak({ slotDates: slots, completionDates: ["2026-10-07", "2026-10-10", "2026-10-11", "2026-10-14"], today: "2026-10-14" }),
    ).toBe(4);
  });

  it("does not break on the latest slot that is still open", () => {
    expect(
      computeStreak({ slotDates: slots, completionDates: ["2026-10-07", "2026-10-09", "2026-10-11"], today: "2026-10-14" }),
    ).toBe(3);
  });

  it("stops at the first missed slot", () => {
    expect(
      computeStreak({ slotDates: slots, completionDates: ["2026-10-07", "2026-10-11", "2026-10-14"], today: "2026-10-14" }),
    ).toBe(2);
  });

  it("ignores future slots and duplicate dates", () => {
    expect(
      computeStreak({ slotDates: [...slots, "2026-10-20", "2026-10-14"], completionDates: ["2026-10-14", "2026-10-14"], today: "2026-10-14" }),
    ).toBe(1);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `pnpm test src/lib/program`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/lib/program/dates.ts`:

```ts
const LABELS = ["П", "В", "С", "Ч", "П", "С", "Н"];

/** Calendar day (YYYY-MM-DD) of an instant in a timezone. */
export function toLocalDate(at: Date | string, timeZone: string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export interface WeekDay {
  date: string;
  label: string;
  isToday: boolean;
  done: boolean;
  slot: boolean;
}

/** Monday-first week containing `today`, flagged with completions and scheduled workout days. */
export function weekStrip(today: string, completionDates: string[], slotDates: string[]): WeekDay[] {
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -weekday);
  const done = new Set(completionDates);
  const slots = new Set(slotDates);
  return LABELS.map((label, i) => {
    const date = addDays(monday, i);
    return { date, label, isToday: date === today, done: done.has(date), slot: slots.has(date) };
  });
}
```

`src/lib/program/pick-today.ts`:

```ts
import type { Level, WorkoutLite } from "./types";

export type TodayPick =
  | { kind: "free"; workoutId: string }
  | { kind: "starter"; workoutId: string; index: number; total: number }
  | { kind: "regular"; workoutId: string }
  | { kind: "rest" }
  | { kind: "locked" };

export function isPublished(w: WorkoutLite, now: Date): boolean {
  return w.publishAt !== null && Date.parse(w.publishAt) <= now.getTime();
}

/** The one workout the Today screen leads with (spec §4 "Днешната тренировка"). */
export function pickToday(input: {
  level: Level;
  hasAccess: boolean;
  starterWeekDone: boolean;
  now: Date;
  workouts: WorkoutLite[];
  completedIds: ReadonlySet<string>;
}): TodayPick {
  const published = input.workouts.filter((w) => isPublished(w, input.now));

  if (!input.hasAccess) {
    const free = published.find((w) => w.kind === "free");
    return free && !input.completedIds.has(free.id) ? { kind: "free", workoutId: free.id } : { kind: "locked" };
  }

  if (!input.starterWeekDone) {
    const starters = published
      .filter((w) => w.kind === "starter")
      .sort((a, b) => (a.starterOrder ?? 0) - (b.starterOrder ?? 0));
    const index = starters.findIndex((w) => !input.completedIds.has(w.id));
    if (index !== -1) {
      return { kind: "starter", workoutId: starters[index]!.id, index: index + 1, total: starters.length };
    }
  }

  const next = published
    .filter((w) => w.kind === "regular" && w.level === input.level && !input.completedIds.has(w.id))
    .sort((a, b) => Date.parse(b.publishAt!) - Date.parse(a.publishAt!))[0];
  return next ? { kind: "regular", workoutId: next.id } : { kind: "rest" };
}
```

`src/lib/program/streak.ts`:

```ts
/**
 * Consecutive scheduled workout slots the user completed, newest first.
 * A slot counts as done if she trained on any day from the slot until the next slot opens.
 * The newest slot does not break the streak while it is still open.
 */
export function computeStreak(input: { slotDates: string[]; completionDates: string[]; today: string }): number {
  const slots = [...new Set(input.slotDates)].filter((d) => d <= input.today).sort();
  const done = [...new Set(input.completionDates)];
  let streak = 0;
  for (let i = slots.length - 1; i >= 0; i--) {
    const start = slots[i]!;
    const end = slots[i + 1] ?? "9999-12-31";
    const hit = done.some((d) => d >= start && d < end);
    if (hit) streak++;
    else if (i === slots.length - 1) continue;
    else break;
  }
  return streak;
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test src/lib/program`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: program logic for today's workout, streak and week strip"
```

---

### Task 7: Onboarding rules — schema, level, plan summary, labels

**Files:**
- Create: `src/lib/labels.ts`, `src/lib/onboarding/schema.ts`, `src/lib/onboarding/schema.test.ts`, `src/lib/onboarding/plan-summary.ts`, `src/lib/onboarding/plan-summary.test.ts`

**Interfaces:**
- Consumes: `Level` from `src/lib/program/types.ts`.
- Produces:
  - `GOALS`, `PROBLEMS`, `EXPERIENCE`, `TIMES`, `FOCUS` (readonly tuples) and label maps `GOAL_LABEL`, `PROBLEM_LABEL`, `EXPERIENCE_LABEL`, `TIME_LABEL`, `FOCUS_LABEL`, `LEVEL_LABEL`, `FEELING_LABEL` in `src/lib/labels.ts`
  - `onboardingSchema` (zod) and `type OnboardingAnswers = z.infer<typeof onboardingSchema>`
  - `levelFromExperience(e: Experience): Level`
  - `buildPlanSummary(p: { goal: Goal | null; problems: string[]; time: Time | null; level: Level }): { headline: string; perWeek: number; minutes: string; focus: string[] }`

- [ ] **Step 1: Labels**

`src/lib/labels.ts`:

```ts
import type { Level } from "@/lib/program/types";

export const GOALS = ["lose_weight", "tone", "strength", "energy"] as const;
export const PROBLEMS = ["belly", "glutes_thighs", "arms", "back_posture", "postpartum", "motivation"] as const;
export const EXPERIENCE = ["never", "sometimes", "regular"] as const;
export const TIMES = ["15", "20-30", "40+"] as const;
export const FOCUS = ["full_body", "core", "glutes_legs", "upper", "stretch", "cardio"] as const;

export type Goal = (typeof GOALS)[number];
export type Problem = (typeof PROBLEMS)[number];
export type Experience = (typeof EXPERIENCE)[number];
export type Time = (typeof TIMES)[number];
export type Focus = (typeof FOCUS)[number];

export const GOAL_LABEL: Record<Goal, string> = {
  lose_weight: "Да сваля килограми",
  tone: "Да стегна тялото",
  strength: "Да стана по-силна",
  energy: "Повече енергия, по-малко стрес",
};

export const PROBLEM_LABEL: Record<Problem, string> = {
  belly: "Коремът",
  glutes_thighs: "Дупе и бедра",
  arms: "Ръцете",
  back_posture: "Гръб и стойка",
  postpartum: "Възстановяване след раждане",
  motivation: "Не мога да съм постоянна",
};

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  never: "Почти не съм тренирала",
  sometimes: "Тренирам от време на време",
  regular: "Тренирам редовно",
};

export const TIME_LABEL: Record<Time, string> = {
  "15": "До 15 минути",
  "20-30": "20–30 минути",
  "40+": "40+ минути",
};

export const FOCUS_LABEL: Record<Focus, string> = {
  full_body: "Цяло тяло",
  core: "Корем",
  glutes_legs: "Дупе и крака",
  upper: "Горна част",
  stretch: "Стречинг",
  cardio: "Кардио",
};

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Начинаещ",
  advanced: "Напреднал",
  pro: "Профи",
};

export const FEELING_LABEL = { easy: "Лесно", right: "Точно", hard: "Трудно" } as const;
```

- [ ] **Step 2: Write the failing tests**

`src/lib/onboarding/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { levelFromExperience, onboardingSchema } from "./schema";

const valid = {
  name: "Мария",
  goal: "tone",
  problems: ["belly", "back_posture"],
  experience: "never",
  heightCm: 168,
  weightKg: 66.5,
  targetWeightKg: 61,
  time: "20-30",
  phone: "",
  phoneCallConsent: false,
  healthConsent: true,
  marketingConsent: false,
};

describe("onboardingSchema", () => {
  it("accepts a complete answer set", () => {
    expect(onboardingSchema.parse(valid).name).toBe("Мария");
  });

  it("requires explicit health-data consent", () => {
    const result = onboardingSchema.safeParse({ ...valid, healthConsent: false });
    expect(result.success).toBe(false);
  });

  it("requires a phone number when she agrees to be called", () => {
    expect(onboardingSchema.safeParse({ ...valid, phoneCallConsent: true }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, phoneCallConsent: true, phone: "+359 888 123 456" }).success).toBe(true);
  });

  it("rejects impossible body values", () => {
    expect(onboardingSchema.safeParse({ ...valid, heightCm: 90 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, weightKg: 400 }).success).toBe(false);
  });

  it("rejects unknown problems", () => {
    expect(onboardingSchema.safeParse({ ...valid, problems: ["knees"] }).success).toBe(false);
  });
});

describe("levelFromExperience", () => {
  it("maps experience to a starting level", () => {
    expect(levelFromExperience("never")).toBe("beginner");
    expect(levelFromExperience("sometimes")).toBe("advanced");
    expect(levelFromExperience("regular")).toBe("pro");
  });
});
```

`src/lib/onboarding/plan-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPlanSummary } from "./plan-summary";

describe("buildPlanSummary", () => {
  it("turns answers into a concrete plan", () => {
    expect(buildPlanSummary({ goal: "tone", problems: ["belly", "back_posture"], time: "20-30", level: "beginner" })).toEqual({
      headline: "4 седмици да стегнеш тялото",
      perWeek: 3,
      minutes: "20–30 минути",
      focus: ["Коремът", "Гръб и стойка"],
    });
  });

  it("falls back to full body when no problem was picked", () => {
    const summary = buildPlanSummary({ goal: null, problems: [], time: null, level: "pro" });
    expect(summary).toEqual({ headline: "4 седмици към по-силната ти версия", perWeek: 4, minutes: "20–30 минути", focus: ["Цяло тяло"] });
  });

  it("drops unknown stored problems instead of crashing", () => {
    expect(buildPlanSummary({ goal: "energy", problems: ["knees"], time: "15", level: "advanced" }).focus).toEqual(["Цяло тяло"]);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `pnpm test src/lib/onboarding`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`src/lib/onboarding/schema.ts`:

```ts
import { z } from "zod";
import { EXPERIENCE, GOALS, PROBLEMS, TIMES, type Experience } from "@/lib/labels";
import type { Level } from "@/lib/program/types";

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(1, "Как да те наричаме?").max(60),
    goal: z.enum(GOALS),
    problems: z.array(z.enum(PROBLEMS)).max(PROBLEMS.length),
    experience: z.enum(EXPERIENCE),
    heightCm: z.number().int().min(120, "Ръстът е между 120 и 230 см").max(230, "Ръстът е между 120 и 230 см"),
    weightKg: z.number().min(30, "Теглото е между 30 и 250 кг").max(250, "Теглото е между 30 и 250 кг"),
    targetWeightKg: z.number().min(30).max(250),
    time: z.enum(TIMES),
    phone: z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, "Невалиден телефон")]),
    phoneCallConsent: z.boolean(),
    healthConsent: z.literal(true, { error: "Без това съгласие не можем да ти направим план." }),
    marketingConsent: z.boolean(),
  })
  .refine((a) => !a.phoneCallConsent || a.phone !== "", {
    path: ["phone"],
    message: "Остави телефон, за да можем да ти се обадим.",
  });

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;

export function levelFromExperience(experience: Experience): Level {
  return experience === "never" ? "beginner" : experience === "sometimes" ? "advanced" : "pro";
}
```

`src/lib/onboarding/plan-summary.ts`:

```ts
import { PROBLEM_LABEL, PROBLEMS, TIME_LABEL, type Goal, type Problem, type Time } from "@/lib/labels";
import type { Level } from "@/lib/program/types";

const HEADLINE: Record<Goal, string> = {
  lose_weight: "4 седмици към по-леката ти версия",
  tone: "4 седмици да стегнеш тялото",
  strength: "4 седмици към по-силната ти версия",
  energy: "4 седмици повече енергия",
};

const PER_WEEK: Record<Level, number> = { beginner: 3, advanced: 3, pro: 4 };

export function buildPlanSummary(p: { goal: Goal | null; problems: string[]; time: Time | null; level: Level }) {
  const focus = p.problems
    .filter((x): x is Problem => (PROBLEMS as readonly string[]).includes(x))
    .map((x) => PROBLEM_LABEL[x]);
  return {
    headline: HEADLINE[p.goal ?? "strength"],
    perWeek: PER_WEEK[p.level],
    minutes: TIME_LABEL[p.time ?? "20-30"],
    focus: focus.length > 0 ? focus : ["Цяло тяло"],
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test src/lib/onboarding`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: onboarding validation, starting level and plan summary"
```

---

### Task 8: Supabase clients, proxy, and auth pages

**Files:**
- Create: `src/lib/supabase/browser.ts`, `src/server/db/server.ts`, `src/server/db/admin.ts`, `src/server/auth/require-user.ts`, `src/lib/auth-redirect.ts`, `src/lib/auth-redirect.test.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/app/login/page.tsx`, `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`, `src/components/ui/button.tsx`, `src/components/ui/field.tsx`

**Interfaces:**
- Consumes: `clientEnv`, `serverEnv`, `AppError`, `cn`.
- Produces: `createBrowserSupabaseClient()`, `createServerSupabaseClient()`, `createAdminSupabaseClient()`, `requireUser() → { user, supabase }`, `decideAuthRedirect({ pathname, search, hasSession }) → string | null`, `safeNext(next: string | null, fallback = "/app") → string`, `<Button variant="primary"|"ghost"|"quiet" size="lg"|"md">`, `<Field label hint error>{input}</Field>`, `inputClass`.

- [ ] **Step 1: Write the failing redirect tests**

`src/lib/auth-redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decideAuthRedirect, safeNext } from "./auth-redirect";

describe("decideAuthRedirect", () => {
  it("sends signed-out visitors of /app and /admin to login with a return path", () => {
    expect(decideAuthRedirect({ pathname: "/app/library", search: "?level=pro", hasSession: false })).toBe(
      "/login?next=%2Fapp%2Flibrary%3Flevel%3Dpro",
    );
    expect(decideAuthRedirect({ pathname: "/admin", search: "", hasSession: false })).toBe("/login?next=%2Fadmin");
  });

  it("sends signed-in visitors of /login to the app", () => {
    expect(decideAuthRedirect({ pathname: "/login", search: "", hasSession: true })).toBe("/app");
  });

  it("leaves everything else alone", () => {
    expect(decideAuthRedirect({ pathname: "/", search: "", hasSession: false })).toBeNull();
    expect(decideAuthRedirect({ pathname: "/start", search: "", hasSession: true })).toBeNull();
    expect(decideAuthRedirect({ pathname: "/application", search: "", hasSession: false })).toBeNull();
  });
});

describe("safeNext", () => {
  it("keeps same-site paths and rejects everything else", () => {
    expect(safeNext("/app/plan")).toBe("/app/plan");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext(null, "/start/finish")).toBe("/start/finish");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm test src/lib/auth-redirect`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement redirect rules**

`src/lib/auth-redirect.ts`:

```ts
const PROTECTED = [/^\/app(\/|$)/, /^\/admin(\/|$)/];

/** Optimistic redirect decided in the proxy; real checks live in requireUser() and RLS. */
export function decideAuthRedirect(input: { pathname: string; search: string; hasSession: boolean }): string | null {
  const isProtected = PROTECTED.some((re) => re.test(input.pathname));
  if (isProtected && !input.hasSession) {
    return `/login?next=${encodeURIComponent(input.pathname + input.search)}`;
  }
  if (input.pathname === "/login" && input.hasSession) return "/app";
  return null;
}

/** A post-login destination that can only point inside this site. */
export function safeNext(next: string | null, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
```

Run: `pnpm test src/lib/auth-redirect` → PASS.

- [ ] **Step 4: Supabase clients and requireUser**

`src/lib/supabase/browser.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
```

`src/server/db/server.ts`:

```ts
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

/** Session-bound client for server components, route handlers and actions. RLS applies. */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
```

`src/server/db/admin.ts`:

```ts
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

/** Service-role client: bypasses RLS. Only for trusted server code (visits, account deletion). */
export function createAdminSupabaseClient() {
  return createClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

`src/server/auth/require-user.ts`:

```ts
import "server-only";

import { AppError } from "@/lib/app-error";
import { createServerSupabaseClient } from "@/server/db/server";

/** Signed-in user + session client, or AppError("UNAUTHORIZED"). getUser() validates the token. */
export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AppError("UNAUTHORIZED", "Влез в профила си.");
  return { user, supabase };
}
```

- [ ] **Step 5: Proxy and OAuth/reset callback**

`src/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/env";
import { decideAuthRedirect } from "@/lib/auth-redirect";

/** Refreshes the Supabase session cookie and applies optimistic auth redirects. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const target = decideAuthRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasSession: user !== null,
  });
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|pwa-icon|manifest.webmanifest|api/visit).*)"],
};
```

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-redirect";
import { createServerSupabaseClient } from "@/server/db/server";

/** Lands Google sign-in and password-reset links: trades the code for a session, then redirects. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
```

- [ ] **Step 6: UI primitives**

`src/components/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const VARIANT = {
  primary: "bg-ember text-white shadow-[0_6px_0_0_var(--color-ember-deep)] active:translate-y-[3px] active:shadow-[0_3px_0_0_var(--color-ember-deep)]",
  ghost: "bg-transparent text-ink ring-2 ring-ink active:translate-y-[2px]",
  quiet: "bg-ink/5 text-ink active:bg-ink/10",
} as const;

const SIZE = { lg: "h-14 px-7 text-base", md: "h-11 px-5 text-sm" } as const;

export function buttonClass(variant: keyof typeof VARIANT = "primary", size: keyof typeof SIZE = "lg") {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color] duration-100 disabled:pointer-events-none disabled:opacity-40",
    VARIANT[variant],
    SIZE[size],
  );
}

export function Button({
  variant = "primary",
  size = "lg",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE }) {
  return <button className={cn(buttonClass(variant, size), className)} {...props} />;
}
```

`src/components/ui/field.tsx`:

```tsx
import type { ReactNode } from "react";

export const inputClass =
  "h-14 w-full rounded-2xl border-2 border-line bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus:border-ink";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? <span className="block text-sm text-brick">{error}</span> : hint ? <span className="block text-sm text-ink-soft">{hint}</span> : null}
    </label>
  );
}
```

- [ ] **Step 7: Login, forgot and reset pages**

`src/app/login/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { clientEnv } from "@/env";
import { safeNext } from "@/lib/auth-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState(params.get("error") === "link" ? "Линкът е невалиден или изтекъл." : "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(form: FormData) {
    setBusy(true);
    setError("");
    const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (signInError) return setError("Грешен имейл или парола.");
    router.replace(next);
    router.refresh();
  }

  async function google() {
    await createBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <h1 className="font-display text-4xl leading-none">Влез</h1>
      <form action={onSubmit} className="space-y-4">
        <Field label="Имейл">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Парола" error={error || undefined}>
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Влизам…" : "Влез"}
        </Button>
      </form>
      {clientEnv.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
        <Button variant="ghost" onClick={google} className="w-full">
          Продължи с Google
        </Button>
      )}
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">Забравена парола</Link>
        <Link href="/start" className="font-semibold underline underline-offset-4">Нямам профил</Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```

`src/app/forgot-password/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  async function onSubmit(form: FormData) {
    await createBrowserSupabaseClient().auth.resetPasswordForEmail(String(form.get("email")), {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    // Same answer whether or not the email exists, so accounts cannot be enumerated.
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="font-display text-3xl">Нова парола</h1>
      {sent ? (
        <p>Ако имаш профил с този имейл, ще получиш линк до минута.</p>
      ) : (
        <form action={onSubmit} className="space-y-4">
          <Field label="Имейл">
            <input name="email" type="email" required className={inputClass} />
          </Field>
          <Button type="submit" className="w-full">Изпрати линк</Button>
        </form>
      )}
    </main>
  );
}
```

`src/app/reset-password/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(form: FormData) {
    const password = String(form.get("password"));
    if (password.length < 10) return setError("Поне 10 символа.");
    const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({ password });
    if (updateError) return setError("Линкът е изтекъл. Поискай нов.");
    router.replace("/app");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="font-display text-3xl">Избери нова парола</h1>
      <form action={onSubmit} className="space-y-4">
        <Field label="Нова парола" hint="Поне 10 символа" error={error || undefined}>
          <input name="password" type="password" autoComplete="new-password" required className={inputClass} />
        </Field>
        <Button type="submit" className="w-full">Запази</Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 8: Typecheck and commit**

Run: `pnpm typecheck && pnpm test`
Expected: no type errors (the pages compile once Task 9 adds the `ember-deep`/`brick` tokens — Tailwind does not fail the typecheck on unknown classes), all unit tests PASS.

```bash
git add -A && git commit -m "feat: Supabase clients, session proxy, login and password reset"
```

---

### Task 9: Design system, brand config, temporary landing

**Files:**
- Create: `src/lib/brand.ts`, `src/components/workout/workout-cover.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`
- Modify: `src/app/globals.css` (replace), `src/app/layout.tsx` (replace), `src/app/page.tsx` (replace)

**Interfaces:**
- Produces: `brand` object (`name`, `shortName`, `tagline`, `themeColor`, `backgroundColor`, `supportEmail`); CSS tokens `paper`, `ink`, `ink-soft`, `line`, `ember`, `ember-deep`, `moss`, `mustard`, `brick`, fonts `font-display`/`font-sans`; `<WorkoutCover level kind title className>` — a generated cover (no provider thumbnail).

- [ ] **Step 1: Brand config**

`src/lib/brand.ts`:

```ts
/** Every brand-specific value. The marketing pass changes this file only. */
export const brand = {
  name: "Форма",
  shortName: "Форма",
  tagline: "Тренировки у дома, които пасват в деня ти.",
  description: "Видео тренировки за жени, по програма, с напомняния и прогрес.",
  themeColor: "#161412",
  backgroundColor: "#F4EFE8",
  supportEmail: "hello@example.com",
} as const;
```

- [ ] **Step 2: Tokens and fonts**

`src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-paper: #f4efe8;
  --color-ink: #161412;
  --color-ink-soft: #5b544d;
  --color-line: #e2dad0;
  --color-ember: #e4572e;
  --color-ember-deep: #a8361a;
  --color-moss: #3f7d5c;
  --color-mustard: #d29a1e;
  --color-brick: #b23a2a;
  --font-display: var(--font-unbounded), system-ui, sans-serif;
  --font-sans: var(--font-manrope), system-ui, sans-serif;
}

html {
  -webkit-tap-highlight-color: transparent;
}

body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-sans);
}

/* Bottom nav clears the iPhone home indicator. */
.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

const display = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["500", "700", "900"], variable: "--font-unbounded" });
const sans = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: brand.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Generated workout cover**

`src/components/workout/workout-cover.tsx`:

```tsx
import { cn } from "@/lib/cn";
import type { Level, WorkoutKind } from "@/lib/program/types";

const TONE: Record<Level | "intro", string> = {
  intro: "bg-ember",
  beginner: "bg-moss",
  advanced: "bg-mustard",
  pro: "bg-brick",
};

/**
 * A typographic cover built from the title. Provider thumbnails are not used:
 * their URLs carry the video ID (see thumbnail_url CHECK in the content migration).
 */
export function WorkoutCover({
  level,
  kind,
  title,
  className,
}: {
  level: Level | null;
  kind: WorkoutKind;
  title: string;
  className?: string;
}) {
  const tone = TONE[kind === "regular" && level ? level : "intro"];
  const word = title.split(/\s+/)[0] ?? title;
  return (
    <div className={cn("relative overflow-hidden", tone, className)} aria-hidden>
      <span className="absolute -bottom-6 -left-2 select-none font-display text-[7rem] font-black uppercase leading-none text-white/15">
        {word}
      </span>
      <span className="absolute right-4 top-4 h-10 w-10 rounded-full border-4 border-white/30" />
    </div>
  );
}
```

- [ ] **Step 4: Temporary landing**

`src/app/page.tsx`:

```tsx
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { brand } from "@/lib/brand";

// Placeholder until the marketing pass designs the real landing page.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-10">
      <p className="font-display text-lg font-bold">{brand.name}</p>
      <div className="space-y-6">
        <h1 className="font-display text-5xl font-black leading-[0.95]">{brand.tagline}</h1>
        <p className="text-lg text-ink-soft">Отговори на 6 въпроса и направи първата си тренировка безплатно.</p>
      </div>
      <div className="space-y-3">
        <Link href="/start" className={buttonClass("primary", "lg") + " w-full"}>
          Започни безплатно
        </Link>
        <Link href="/login" className={buttonClass("quiet", "lg") + " w-full"}>
          Имам профил
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Friendly 404 and error screens (spec §9)**

`src/app/not-found.tsx`:

```tsx
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <p className="font-display text-7xl font-black text-ember">404</p>
      <h1 className="font-display text-2xl font-bold">Тази страница я няма</h1>
      <Link href="/app" className={buttonClass("primary", "md")}>Към тренировките</Link>
    </main>
  );
}
```

`src/app/error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-2xl font-bold">Нещо се обърка</h1>
      <p className="text-ink-soft">Не е от теб. Опитай отново след секунда.</p>
      <Button onClick={reset} size="md">Опитай пак</Button>
    </main>
  );
}
```

- [ ] **Step 6: Verify in the browser**

Start the preview (`preview_start` with name `fit-platform-dev`), open `/`, `/login` and `/no-such-page` at the mobile preset (375×812). Check: Cyrillic headline renders in Unbounded (not a fallback serif), primary button shows the darker bottom edge and presses down on click, no horizontal scroll, no console errors (`read_console_messages`).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: design tokens, brand config, generated covers, temporary landing"
```

---

### Task 10: Onboarding wizard and saving the answers

**Files:**
- Create: `src/server/onboarding/save-onboarding.ts`, `supabase/tests/onboarding.test.ts`, `src/app/start/actions.ts`, `src/app/start/page.tsx`, `src/app/start/finish/page.tsx`, `src/components/onboarding/steps.tsx`, `src/components/onboarding/wizard.tsx`, `src/components/onboarding/storage.ts`

**Interfaces:**
- Consumes: `onboardingSchema`, `levelFromExperience`, label tuples, `requireUser`, `actionOk/actionFail`, `createBrowserSupabaseClient`, `Button`, `Field`.
- Produces:
  - `saveOnboarding(db: TypedClient, userId: string, raw: unknown): Promise<{ freeWorkoutId: string }>` (validates, writes profile, returns the free workout)
  - server action `completeOnboarding(raw: unknown): Promise<ActionResult<{ freeWorkoutId: string }>>`
  - `ANSWERS_KEY = "fp_onboarding_v1"`, `saveDraft(a)`, `loadDraft(): Partial<Draft> | null`, `clearDraft()`
  - Type alias `TypedClient = SupabaseClient<Database>` exported from `src/server/db/types.ts` (create it here; later tasks import it).

- [ ] **Step 1: Shared client type**

`src/server/db/types.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type TypedClient = SupabaseClient<Database>;
```

- [ ] **Step 2: Write the failing integration test**

`supabase/tests/onboarding.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { saveOnboarding } from "@/server/onboarding/save-onboarding";
import { adminClient, createUser, freeWorkoutId, signedInClient, type TypedClient } from "./helpers";

const answers = {
  name: "Мария",
  goal: "lose_weight",
  problems: ["belly", "postpartum"],
  experience: "sometimes",
  heightCm: 165,
  weightKg: 72,
  targetWeightKg: 64,
  time: "15",
  phone: "+359888123456",
  phoneCallConsent: true,
  healthConsent: true,
  marketingConsent: true,
};

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("saveOnboarding", () => {
  it("stores answers, starting level and consent, and returns the free workout", async () => {
    const user = await createUser(admin, "onb");
    const result = await saveOnboarding(await signedInClient(user), user.id, answers);
    expect(result.freeWorkoutId).toBe(await freeWorkoutId(admin));

    const { data } = await admin.from("profiles").select("*").eq("id", user.id).single();
    expect(data).toMatchObject({
      name: "Мария",
      goal: "lose_weight",
      problems: ["belly", "postpartum"],
      level: "advanced",
      height_cm: 165,
      weight_kg: 72,
      target_weight_kg: 64,
      time_per_session: "15",
      phone: "+359888123456",
      phone_call_consent: true,
      marketing_consent: true,
      onboarding_done: true,
    });
    expect(data?.health_data_consent_at).not.toBeNull();
  });

  it("rejects answers without health consent and leaves the profile untouched", async () => {
    const user = await createUser(admin, "onb-no");
    await expect(
      saveOnboarding(await signedInClient(user), user.id, { ...answers, healthConsent: false }),
    ).rejects.toThrow();
    const { data } = await admin.from("profiles").select("onboarding_done").eq("id", user.id).single();
    expect(data?.onboarding_done).toBe(false);
  });

  it("stores an empty phone as null", async () => {
    const user = await createUser(admin, "onb-phone");
    await saveOnboarding(await signedInClient(user), user.id, { ...answers, phone: "", phoneCallConsent: false });
    const { data } = await admin.from("profiles").select("phone").eq("id", user.id).single();
    expect(data?.phone).toBeNull();
  });
});
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/onboarding.test.ts`
Expected: FAIL — cannot find `@/server/onboarding/save-onboarding`.

- [ ] **Step 3: Implement the service and action**

`src/server/onboarding/save-onboarding.ts`:

```ts
import { AppError } from "@/lib/app-error";
import { levelFromExperience, onboardingSchema } from "@/lib/onboarding/schema";
import type { TypedClient } from "@/server/db/types";

/** Validates the questionnaire and writes it to the user's profile. Throws ZodError/AppError. */
export async function saveOnboarding(db: TypedClient, userId: string, raw: unknown): Promise<{ freeWorkoutId: string }> {
  const a = onboardingSchema.parse(raw);
  const { error } = await db
    .from("profiles")
    .update({
      name: a.name,
      goal: a.goal,
      problems: a.problems,
      level: levelFromExperience(a.experience),
      height_cm: a.heightCm,
      weight_kg: a.weightKg,
      target_weight_kg: a.targetWeightKg,
      time_per_session: a.time,
      phone: a.phone === "" ? null : a.phone,
      phone_call_consent: a.phoneCallConsent,
      marketing_consent: a.marketingConsent,
      health_data_consent_at: new Date().toISOString(),
      onboarding_done: true,
    })
    .eq("id", userId);
  if (error) throw new AppError("INVALID", "Не успяхме да запазим отговорите. Опитай пак.");

  const { data: free, error: freeError } = await db.from("workouts").select("id").eq("kind", "free").maybeSingle();
  if (freeError || !free) throw new AppError("NOT_FOUND", "Безплатната тренировка още не е качена.");
  return { freeWorkoutId: free.id };
}
```

`src/app/start/actions.ts`:

```ts
"use server";

import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import { saveOnboarding } from "@/server/onboarding/save-onboarding";

export async function completeOnboarding(raw: unknown): Promise<ActionResult<{ freeWorkoutId: string }>> {
  try {
    const { user, supabase } = await requireUser();
    return actionOk(await saveOnboarding(supabase, user.id, raw));
  } catch (error) {
    return actionFail(error);
  }
}
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/onboarding.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Draft storage (survives the Google redirect)**

`src/components/onboarding/storage.ts`:

```ts
import type { OnboardingAnswers } from "@/lib/onboarding/schema";

export const ANSWERS_KEY = "fp_onboarding_v1";
export type Draft = Partial<OnboardingAnswers>;

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(draft));
  } catch {
    // Private mode / storage blocked: the email path still works without the draft.
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(ANSWERS_KEY);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 5: Step components**

`src/components/onboarding/steps.tsx`:

```tsx
"use client";

import { cn } from "@/lib/cn";

/** One big tappable card per option. */
export function ChoiceList<T extends string>({
  options,
  labels,
  value,
  onChange,
  multiple = false,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | T[] | undefined;
  onChange: (next: T | T[]) => void;
  multiple?: boolean;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  function toggle(option: T) {
    if (!multiple) return onChange(option);
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange([...next]);
  }
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const on = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option)}
            className={cn(
              "flex min-h-16 items-center justify-between rounded-3xl border-2 px-5 text-left text-lg font-semibold transition-all active:scale-[0.98]",
              on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink",
            )}
          >
            {labels[option]}
            <span className={cn("h-6 w-6 rounded-full border-2", on ? "border-paper bg-ember" : "border-line")} />
          </button>
        );
      })}
    </div>
  );
}

/** A large number with a slider under it. */
export function NumberSlider({
  label,
  unit,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="font-display text-4xl font-bold tabular-nums">
          {value}
          <span className="ml-1 text-base font-medium text-ink-soft">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-ember)]"
        aria-label={label}
      />
    </div>
  );
}
```

- [ ] **Step 6: The wizard**

`src/components/onboarding/wizard.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { completeOnboarding } from "@/app/start/actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { clientEnv } from "@/env";
import {
  EXPERIENCE, EXPERIENCE_LABEL, GOAL_LABEL, GOALS, PROBLEM_LABEL, PROBLEMS, TIME_LABEL, TIMES,
} from "@/lib/labels";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ChoiceList, NumberSlider } from "./steps";
import { clearDraft, loadDraft, saveDraft, type Draft } from "./storage";

const DEFAULTS: Draft = {
  problems: [], heightCm: 165, weightKg: 68, targetWeightKg: 62, phone: "",
  phoneCallConsent: false, healthConsent: undefined, marketingConsent: false, name: "",
};

type StepId = "goal" | "problems" | "experience" | "body" | "time" | "contact" | "account";

export function Wizard({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const steps: StepId[] = ["goal", "problems", "experience", "body", "time", "contact", ...(signedIn ? [] : ["account" as const])];
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = loadDraft();
    if (saved) setDraft({ ...DEFAULTS, ...saved });
  }, []);

  const step = steps[index]!;
  const set = (patch: Draft) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveDraft(next);
  };

  const canContinue: Record<StepId, boolean> = {
    goal: Boolean(draft.goal),
    problems: true,
    experience: Boolean(draft.experience),
    body: true,
    time: Boolean(draft.time),
    contact: Boolean(draft.name?.trim()) && draft.healthConsent === true && (!draft.phoneCallConsent || Boolean(draft.phone)),
    account: true,
  };

  async function finish() {
    setBusy(true);
    setError("");
    const result = await completeOnboarding(draft);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    clearDraft();
    router.replace(`/app/workout/${result.data.freeWorkoutId}?first=1`);
  }

  async function signUp(form: FormData) {
    setBusy(true);
    setError("");
    const { error: signUpError } = await createBrowserSupabaseClient().auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: { data: { name: draft.name } },
    });
    if (signUpError) {
      setBusy(false);
      return setError(
        /registered|exists/i.test(signUpError.message)
          ? "Вече има профил с този имейл. Влез от „Имам профил“."
          : signUpError.message.includes("Password") ? "Паролата трябва да е поне 10 символа." : "Не успяхме да създадем профила.",
      );
    }
    await finish();
  }

  async function google() {
    saveDraft(draft);
    await createBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/start/finish` },
    });
  }

  const next = () => (step === "contact" && signedIn ? finish() : setIndex((i) => Math.min(i + 1, steps.length - 1)));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-8 pt-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          className="h-10 w-10 rounded-full bg-ink/5 text-xl disabled:opacity-0"
          disabled={index === 0}
          aria-label="Назад"
        >
          ←
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full bg-ember" animate={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22 }}
          className="flex flex-1 flex-col gap-6 pt-10"
        >
          {step === "goal" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Какво искаш да постигнеш?</h1>
              <ChoiceList options={GOALS} labels={GOAL_LABEL} value={draft.goal} onChange={(v) => set({ goal: v as Draft["goal"] })} />
            </>
          )}
          {step === "problems" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Какво те притеснява най-много?</h1>
              <p className="-mt-3 text-ink-soft">Избери всичко, което важи.</p>
              <ChoiceList multiple options={PROBLEMS} labels={PROBLEM_LABEL} value={draft.problems} onChange={(v) => set({ problems: v as Draft["problems"] })} />
            </>
          )}
          {step === "experience" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Колко тренираш досега?</h1>
              <ChoiceList options={EXPERIENCE} labels={EXPERIENCE_LABEL} value={draft.experience} onChange={(v) => set({ experience: v as Draft["experience"] })} />
            </>
          )}
          {step === "body" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Отправна точка</h1>
              <p className="-mt-3 text-ink-soft">Само ти и треньорът ти виждате тези числа.</p>
              <NumberSlider label="Ръст" unit="см" min={140} max={200} value={draft.heightCm ?? 165} onChange={(v) => set({ heightCm: v })} />
              <NumberSlider label="Тегло" unit="кг" min={40} max={150} step={0.5} value={draft.weightKg ?? 68} onChange={(v) => set({ weightKg: v })} />
              <NumberSlider label="Цел" unit="кг" min={40} max={150} step={0.5} value={draft.targetWeightKg ?? 62} onChange={(v) => set({ targetWeightKg: v })} />
            </>
          )}
          {step === "time" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Колко време имаш за тренировка?</h1>
              <ChoiceList options={TIMES} labels={TIME_LABEL} value={draft.time} onChange={(v) => set({ time: v as Draft["time"] })} />
            </>
          )}
          {step === "contact" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Почти готово</h1>
              <Field label="Как да те наричаме?">
                <input className={inputClass} value={draft.name ?? ""} onChange={(e) => set({ name: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field label="Телефон (по желание)" hint="Ако нещо не върви, треньорът може да ти звънне.">
                <input className={inputClass} type="tel" value={draft.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" />
              </Field>
              <Consent checked={draft.phoneCallConsent === true} onChange={(v) => set({ phoneCallConsent: v })}>
                Съгласна съм треньорът да ми се обади.
              </Consent>
              <Consent checked={draft.healthConsent === true} onChange={(v) => set({ healthConsent: v ? true : undefined })}>
                <strong>Задължително:</strong> съгласна съм да се обработват данните ми за тегло, мерки и здравословни проблеми, за да получа персонален план.
              </Consent>
              <Consent checked={draft.marketingConsent === true} onChange={(v) => set({ marketingConsent: v })}>
                Искам да получавам съвети и оферти по имейл.
              </Consent>
            </>
          )}
          {step === "account" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Създай профила си и започни</h1>
              <form action={signUp} className="space-y-4">
                <Field label="Имейл">
                  <input name="email" type="email" required autoComplete="email" className={inputClass} />
                </Field>
                <Field label="Парола" hint="Поне 10 символа">
                  <input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
                </Field>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Подготвяме плана ти…" : "Към първата тренировка"}
                </Button>
              </form>
              {clientEnv.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
                <Button variant="ghost" onClick={google} className="w-full">
                  Продължи с Google
                </Button>
              )}
              <Link href="/login" className="text-center text-sm underline underline-offset-4">
                Имам профил
              </Link>
            </>
          )}
          {error && <p role="alert" className="rounded-2xl bg-brick/10 p-4 text-brick">{error}</p>}
        </motion.section>
      </AnimatePresence>

      {step !== "account" && (
        <Button onClick={next} disabled={!canContinue[step] || busy} className="mt-6 w-full">
          {step === "contact" && signedIn ? (busy ? "Подготвяме плана ти…" : "Към първата тренировка") : "Напред"}
        </Button>
      )}
    </main>
  );
}

function Consent({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex gap-3 text-sm leading-snug">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ember)]" />
      <span>{children}</span>
    </label>
  );
}
```

- [ ] **Step 7: Pages**

`src/app/start/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Wizard } from "@/components/onboarding/wizard";
import { createServerSupabaseClient } from "@/server/db/server";

export const metadata = { title: "Твоят план" };

export default async function StartPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("onboarding_done").eq("id", user.id).single();
    if (profile?.onboarding_done) redirect("/app");
  }
  return <Wizard signedIn={user !== null} />;
}
```

`src/app/start/finish/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { completeOnboarding } from "@/app/start/actions";
import { clearDraft, loadDraft } from "@/components/onboarding/storage";

/** After Google sign-in (or a returning user without onboarding): submit the saved answers. */
export default function FinishPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const draft = loadDraft();
    if (!draft) return router.replace("/start");
    completeOnboarding(draft).then((result) => {
      if (!result.ok) {
        setError(result.message);
        setTimeout(() => router.replace("/start"), 2500);
        return;
      }
      clearDraft();
      router.replace(`/app/workout/${result.data.freeWorkoutId}?first=1`);
    });
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <p className="font-display text-2xl font-bold">{error || "Изграждаме твоя план…"}</p>
    </main>
  );
}
```

- [ ] **Step 8: Verify in the browser**

With the dev server running: at mobile size go through `/start` → all 7 steps → sign up with a fresh `@example.test` email and a 10+ char password. Expected: lands on `/app/workout/<free-id>?first=1` (404 until Task 12 — acceptable now; confirm the URL). Then check `profiles` via `DOCKER_CONFIG=/tmp/dockercfg pnpm exec supabase db dump --local --data-only -s public 2>/dev/null | grep -c onboarding` is not needed — instead run in the test DB: `pnpm test:db supabase/tests/onboarding.test.ts` stays green. Also: reload mid-wizard → answers restored; „Напред" stays disabled on step 6 until name + health consent are set.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: onboarding questionnaire with account creation and saved answers"
```

---

### Task 11: App shell and the Today screen

**Files:**
- Create: `src/server/content/today.ts`, `supabase/tests/today.test.ts`, `scripts/dev-grant-access.mjs`, `scripts/dev-set-duration.mjs`, `src/app/app/layout.tsx`, `src/app/app/page.tsx`, `src/components/app/bottom-nav.tsx`, `src/components/today/week-strip.tsx`, `src/components/today/countdown.tsx`, `src/components/workout/workout-card.tsx`

**Interfaces:**
- Consumes: `pickToday`, `computeStreak`, `weekStrip`, `toLocalDate`, `WorkoutLite`, `TypedClient`, `requireUser`, `WorkoutCover`, `LEVEL_LABEL`, `FOCUS_LABEL`.
- Produces:
  - `interface WorkoutSummary { id: string; title: string; description: string; kind: WorkoutKind; level: Level | null; durationMin: number; focus: string[]; thumbnailUrl: string | null; publishAt: string | null; starterOrder: number | null }`
  - `toSummary(row): WorkoutSummary` and `WORKOUT_COLUMNS` (select string) — exported from `src/server/content/today.ts`
  - `interface TodayView { name: string; level: Level; hasAccess: boolean; pick: TodayPick; workout: WorkoutSummary | null; streak: number; week: WeekDay[]; nextDropAt: string | null; doneTotal: number }`
  - `getTodayView(db: TypedClient, userId: string, now?: Date): Promise<TodayView>`
  - `<WorkoutCard workout locked href />`

- [ ] **Step 1: Write the failing integration test**

`supabase/tests/today.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { getTodayView } from "@/server/content/today";
import { adminClient, createUser, freeWorkoutId, grantAccess, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("getTodayView", () => {
  it("leads a new user without access to the free workout", async () => {
    const user = await createUser(admin, "today-free", { name: "Ани" });
    const view = await getTodayView(await signedInClient(user), user.id);
    expect(view.pick).toEqual({ kind: "free", workoutId: await freeWorkoutId(admin) });
    expect(view.workout?.kind).toBe("free");
    expect(view.hasAccess).toBe(false);
    expect(view.name).toBe("Ани");
  });

  it("starts a subscriber on starter 1 and shows the next beginner drop", async () => {
    const user = await createUser(admin, "today-sub");
    await grantAccess(admin, user.id);
    const view = await getTodayView(await signedInClient(user), user.id);
    expect(view.pick).toMatchObject({ kind: "starter", index: 1 });
    expect(view.workout?.starterOrder).toBe(1);
    expect(view.nextDropAt).not.toBeNull();
    expect(view.week).toHaveLength(7);
  });

  it("counts finished workouts", async () => {
    const user = await createUser(admin, "today-done");
    const db = await signedInClient(user);
    await db.from("workout_completions").insert({ workout_id: await freeWorkoutId(admin) });
    const view = await getTodayView(db, user.id);
    expect(view.doneTotal).toBe(1);
    expect(view.pick).toEqual({ kind: "locked" });
  });
});
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/today.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the service**

`src/server/content/today.ts`:

```ts
import { AppError } from "@/lib/app-error";
import { toLocalDate, weekStrip, type WeekDay } from "@/lib/program/dates";
import { pickToday, type TodayPick } from "@/lib/program/pick-today";
import { computeStreak } from "@/lib/program/streak";
import type { Level, WorkoutKind, WorkoutLite } from "@/lib/program/types";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

export const WORKOUT_COLUMNS =
  "id, title, description, kind, level, duration_min, focus, thumbnail_url, publish_at, starter_order" as const;

type WorkoutRow = Pick<
  Database["public"]["Tables"]["workouts"]["Row"],
  "id" | "title" | "description" | "kind" | "level" | "duration_min" | "focus" | "thumbnail_url" | "publish_at" | "starter_order"
>;

export interface WorkoutSummary {
  id: string;
  title: string;
  description: string;
  kind: WorkoutKind;
  level: Level | null;
  durationMin: number;
  focus: string[];
  thumbnailUrl: string | null;
  publishAt: string | null;
  starterOrder: number | null;
}

export function toSummary(row: WorkoutRow): WorkoutSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    level: row.level,
    durationMin: row.duration_min,
    focus: row.focus,
    thumbnailUrl: row.thumbnail_url,
    publishAt: row.publish_at,
    starterOrder: row.starter_order,
  };
}

export interface TodayView {
  name: string;
  level: Level;
  hasAccess: boolean;
  pick: TodayPick;
  workout: WorkoutSummary | null;
  streak: number;
  week: WeekDay[];
  nextDropAt: string | null;
  doneTotal: number;
}

export async function getTodayView(db: TypedClient, userId: string, now = new Date()): Promise<TodayView> {
  const [profileRes, workoutsRes, completionsRes, accessRes] = await Promise.all([
    db.from("profiles").select("name, level, timezone, starter_week_done_at").eq("id", userId).single(),
    db.from("workouts").select(WORKOUT_COLUMNS),
    db.from("workout_completions").select("workout_id, local_date").eq("user_id", userId),
    db.rpc("my_access"),
  ]);
  if (profileRes.error || !profileRes.data) throw new AppError("NOT_FOUND", "Профилът не е намерен.");
  if (workoutsRes.error || completionsRes.error || accessRes.error) {
    throw new Error(`today view query failed: ${workoutsRes.error?.message ?? completionsRes.error?.message ?? accessRes.error?.message}`);
  }

  const profile = profileRes.data;
  const workouts = workoutsRes.data.map(toSummary);
  const completions = completionsRes.data;
  const completedIds = new Set(completions.map((c) => c.workout_id));
  const lite: WorkoutLite[] = workouts.map(({ id, kind, level, starterOrder, publishAt }) => ({ id, kind, level, starterOrder, publishAt }));

  const pick = pickToday({
    level: profile.level,
    hasAccess: accessRes.data === true,
    starterWeekDone: profile.starter_week_done_at !== null,
    now,
    workouts: lite,
    completedIds,
  });

  const today = toLocalDate(now, profile.timezone);
  const slotDates = workouts
    .filter((w) => w.kind === "regular" && w.level === profile.level && w.publishAt)
    .map((w) => toLocalDate(w.publishAt!, profile.timezone));
  const completionDates = completions.map((c) => c.local_date);

  const { data: nextDropAt } = await db.rpc("next_drop_at", { p_level: profile.level });

  return {
    name: profile.name,
    level: profile.level,
    hasAccess: accessRes.data === true,
    pick,
    workout: "workoutId" in pick ? (workouts.find((w) => w.id === pick.workoutId) ?? null) : null,
    streak: computeStreak({ slotDates, completionDates, today }),
    week: weekStrip(today, completionDates, slotDates),
    nextDropAt: nextDropAt ?? null,
    doneTotal: completions.length,
  };
}
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/today.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Shell components**

`src/components/app/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/app", label: "Днес", match: (p: string) => p === "/app" },
  { href: "/app/library", label: "Библиотека", match: (p: string) => p.startsWith("/app/library") },
  { href: "/app/profile", label: "Профил", match: (p: string) => p.startsWith("/app/profile") || p.startsWith("/app/check-in") },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/app/workout/")) return null; // the player is full-screen
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-around px-4 pt-2">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn("flex flex-col items-center gap-1 px-4 py-1 text-xs font-semibold transition-colors", active ? "text-ink" : "text-ink-soft")}
              >
                <span className={cn("h-1.5 w-6 rounded-full transition-all", active ? "bg-ember" : "bg-transparent")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`src/components/today/week-strip.tsx`:

```tsx
import type { WeekDay } from "@/lib/program/dates";
import { cn } from "@/lib/cn";

export function WeekStrip({ week }: { week: WeekDay[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {week.map((d) => (
        <li key={d.date} className="flex flex-col items-center gap-1.5">
          <span className={cn("text-xs font-semibold", d.isToday ? "text-ink" : "text-ink-soft")}>{d.label}</span>
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold",
              d.done ? "border-ink bg-ink text-paper" : d.slot ? "border-ember text-ember" : "border-line text-ink-soft",
              d.isToday && !d.done && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
            )}
            aria-label={`${d.date}${d.done ? ", тренирала" : ""}${d.slot ? ", има тренировка" : ""}`}
          >
            {d.done ? "✓" : Number(d.date.slice(8))}
          </span>
        </li>
      ))}
    </ol>
  );
}
```

`src/components/today/countdown.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  if (ms <= 0) return "сега";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} д. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes % 60} мин.`;
  return `${minutes % 60} мин.`;
}

export function Countdown({ to }: { to: string }) {
  const [left, setLeft] = useState(() => Date.parse(to) - Date.now());
  useEffect(() => {
    const timer = setInterval(() => setLeft(Date.parse(to) - Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [to]);
  return <span className="tabular-nums">{format(left)}</span>;
}
```

`src/components/workout/workout-card.tsx`:

```tsx
import Link from "next/link";
import { FOCUS_LABEL, LEVEL_LABEL, type Focus } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";
import { WorkoutCover } from "./workout-cover";

export function WorkoutCard({ workout, locked }: { workout: WorkoutSummary; locked: boolean }) {
  const href = locked ? "/app/plan" : `/app/workout/${workout.id}`;
  return (
    <Link href={href} className="group block overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-line transition-transform active:scale-[0.98]">
      <div className="relative">
        <WorkoutCover level={workout.level} kind={workout.kind} title={workout.title} className="h-28" />
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-bold text-paper">🔒 С абонамент</span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="font-semibold leading-snug">{workout.title}</p>
        <p className="text-sm text-ink-soft">
          {workout.durationMin} мин
          {workout.level ? ` · ${LEVEL_LABEL[workout.level]}` : ""}
          {workout.focus.length ? ` · ${workout.focus.map((f) => FOCUS_LABEL[f as Focus] ?? f).join(", ")}` : ""}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: App layout and Today page**

`src/app/app/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/app/bottom-nav";
import { createServerSupabaseClient } from "@/server/db/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");
  const { data: profile } = await supabase.from("profiles").select("onboarding_done").eq("id", user.id).single();
  if (!profile?.onboarding_done) redirect("/start/finish");
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      {children}
      <BottomNav />
    </div>
  );
}
```

`src/app/app/page.tsx`:

```tsx
import Link from "next/link";
import { Countdown } from "@/components/today/countdown";
import { WeekStrip } from "@/components/today/week-strip";
import { buttonClass } from "@/components/ui/button";
import { WorkoutCover } from "@/components/workout/workout-cover";
import { LEVEL_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/auth/require-user";
import { getTodayView } from "@/server/content/today";

export const metadata = { title: "Днес" };

export default async function TodayPage() {
  const { user, supabase } = await requireUser();
  const view = await getTodayView(supabase, user.id);
  const firstName = view.name.split(" ")[0] || "здравей";

  return (
    <main className="space-y-8 px-5 pt-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-soft">{LEVEL_LABEL[view.level]}</p>
          <h1 className="font-display text-3xl font-bold">Здравей, {firstName}</h1>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-black leading-none">{view.streak}</p>
          <p className="text-xs font-semibold text-ink-soft">поредни</p>
        </div>
      </header>

      <WeekStrip week={view.week} />

      {view.workout ? (
        <Link href={`/app/workout/${view.workout.id}`} className="block overflow-hidden rounded-[2rem] bg-ink text-paper active:scale-[0.99]">
          <WorkoutCover level={view.workout.level} kind={view.workout.kind} title={view.workout.title} className="h-44" />
          <div className="space-y-3 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-paper/60">
              {view.pick.kind === "free" && "Безплатна първа тренировка"}
              {view.pick.kind === "starter" && `Стартова седмица · ${view.pick.index} от ${view.pick.total}`}
              {view.pick.kind === "regular" && "Днешната тренировка"}
            </p>
            <p className="font-display text-2xl font-bold leading-tight">{view.workout.title}</p>
            <p className="text-paper/70">{view.workout.durationMin} минути</p>
            <span className={buttonClass("primary", "md")}>Започни</span>
          </div>
        </Link>
      ) : view.pick.kind === "locked" ? (
        <section className="space-y-4 rounded-[2rem] bg-white p-6 ring-1 ring-line">
          <p className="font-display text-2xl font-bold">Готова си за следващата крачка</p>
          <p className="text-ink-soft">Отключи стартовата седмица и всички тренировки за твоето ниво.</p>
          <Link href="/app/plan" className={buttonClass("primary", "md")}>Виж плана си</Link>
        </section>
      ) : (
        <section className="space-y-2 rounded-[2rem] bg-white p-6 ring-1 ring-line">
          <p className="font-display text-2xl font-bold">Днес е за почивка</p>
          <p className="text-ink-soft">
            Направи всичко публикувано. Повтори любима тренировка от <Link href="/app/library" className="underline">библиотеката</Link>.
          </p>
        </section>
      )}

      {view.nextDropAt && (
        <p className="rounded-2xl bg-ink/5 px-5 py-4 text-sm">
          Нова тренировка след <strong><Countdown to={view.nextDropAt} /></strong>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/check-in" className={buttonClass("ghost", "md")}>Отбележи прогрес</Link>
        <Link href="/app/library" className={buttonClass("quiet", "md")}>Библиотека</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify in the browser**

Create two local-only helper scripts (service role from `.env.local`; never deployed):

`scripts/dev-grant-access.mjs`:

```js
// Usage: node --env-file=.env.local scripts/dev-grant-access.mjs someone@example.test
import { createClient } from "@supabase/supabase-js";

const [email] = process.argv.slice(2);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: profile, error } = await db.from("profiles").select("id").eq("email", email).single();
if (error) throw error;
const result = await db.from("subscriptions").upsert({ user_id: profile.id, provider: "manual", status: "active" });
if (result.error) throw result.error;
console.log(`access granted to ${email}`);
```

`scripts/dev-set-duration.mjs`:

```js
// Usage: node --env-file=.env.local scripts/dev-set-duration.mjs 1
// Shortens free + starter workouts so the 70% unlock can be tested quickly. `pnpm db:reset` restores.
import { createClient } from "@supabase/supabase-js";

const minutes = Number(process.argv[2] ?? 1);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { error } = await db.from("workouts").update({ duration_min: minutes }).in("kind", ["free", "starter"]);
if (error) throw error;
console.log(`free + starter workouts now last ${minutes} min`);
```

Sign in as the user from Task 10 → `/app` at mobile size: header with name and level, 7-day strip with today ringed, dark card „Безплатна първа тренировка", countdown line. Run `node --env-file=.env.local scripts/dev-grant-access.mjs <her email>`, reload → card shows „Стартова седмица · 1 от 5". No console errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: app shell with bottom nav and the Today screen"
```

---

### Task 12: Workout player, completion and feeling

**Files:**
- Create: `src/server/content/completion.ts`, `src/server/content/workouts.ts`, `supabase/tests/completion.test.ts`, `src/app/app/workout/[id]/page.tsx`, `src/app/app/workout/[id]/actions.ts`, `src/components/workout/player.tsx`

**Interfaces:**
- Consumes: `parseVideoUrl`, `toSummary`, `WORKOUT_COLUMNS`, `WorkoutSummary`, `TypedClient`, `requireUser`, `AppError`, `actionOk/actionFail`, `FEELING_LABEL`, `toLocalDate`.
- Produces:
  - `type PlayerView = { workout: WorkoutSummary; state: "ok"; embedUrl: string } | { workout: WorkoutSummary; state: "locked" | "broken" }`
  - `getWorkoutForPlayer(db, workoutId): Promise<PlayerView | null>` (null = not visible; `locked` = no access; `broken` = access but the stored link does not parse)
  - `markWorkoutComplete(db, workoutId): Promise<{ status: "done" | "already"; completionId: string }>`
  - `setCompletionFeeling(db, completionId, feeling: "easy" | "right" | "hard"): Promise<void>`
  - server actions `completeWorkout(workoutId)` and `rateWorkout(completionId, feeling)` returning `ActionResult`
  - `<Player workout embedUrl first unlockAfterSec />`

- [ ] **Step 1: Write the failing integration test**

`supabase/tests/completion.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { markWorkoutComplete, setCompletionFeeling } from "@/server/content/completion";
import { getWorkoutForPlayer } from "@/server/content/workouts";
import {
  adminClient,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let freeId: string;
let paidId: string;

beforeAll(async () => {
  admin = adminClient();
  freeId = await freeWorkoutId(admin);
  const { data } = await admin
    .from("workouts").select("id").eq("kind", "regular").lte("publish_at", new Date().toISOString()).limit(1).single();
  paidId = data!.id;
});

describe("getWorkoutForPlayer", () => {
  it("returns an embed for the free workout and a locked view for paid ones", async () => {
    const db = await signedInClient(await createUser(admin, "player"));
    const free = await getWorkoutForPlayer(db, freeId);
    expect(free?.state).toBe("ok");
    expect(free?.state === "ok" && free.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    const paid = await getWorkoutForPlayer(db, paidId);
    expect(paid).toMatchObject({ state: "locked", workout: { id: paidId } });
    expect(paid && "embedUrl" in paid).toBe(false);
  });

  it("reports a broken link instead of a lock when the stored URL does not parse", async () => {
    const user = await createUser(admin, "broken");
    await grantAccess(admin, user.id);
    const brokenId = await createWorkout(admin, {
      title: "Счупен линк", kind: "regular", level: "pro", duration_min: 10, publish_at: new Date(Date.now() - 60_000).toISOString(),
    });
    await admin.from("workout_media").update({ video_url: "https://example.com/video" }).eq("workout_id", brokenId);
    const view = await getWorkoutForPlayer(await signedInClient(user), brokenId);
    expect(view?.state).toBe("broken");
  });

  it("returns null for an unknown or malformed id", async () => {
    const db = await signedInClient(await createUser(admin, "player-404"));
    expect(await getWorkoutForPlayer(db, crypto.randomUUID())).toBeNull();
    expect(await getWorkoutForPlayer(db, "not-a-uuid")).toBeNull();
  });
});

describe("markWorkoutComplete", () => {
  it("is idempotent within a day", async () => {
    const db = await signedInClient(await createUser(admin, "twice"));
    const first = await markWorkoutComplete(db, freeId);
    const second = await markWorkoutComplete(db, freeId);
    expect(first.status).toBe("done");
    expect(second).toEqual({ status: "already", completionId: first.completionId });
  });

  it("refuses a locked workout with a readable error", async () => {
    const db = await signedInClient(await createUser(admin, "locked"));
    await expect(markWorkoutComplete(db, paidId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stores how the workout felt", async () => {
    const db = await signedInClient(await createUser(admin, "feel"));
    const { completionId } = await markWorkoutComplete(db, freeId);
    await setCompletionFeeling(db, completionId, "hard");
    const { data } = await admin.from("workout_completions").select("feeling").eq("id", completionId).single();
    expect(data?.feeling).toBe("hard");
  });
});
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/completion.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 2: Implement the services**

`src/server/content/workouts.ts`:

```ts
import { parseVideoUrl } from "@/lib/video/parse-video-url";
import type { TypedClient } from "@/server/db/types";
import { toSummary, WORKOUT_COLUMNS, type WorkoutSummary } from "./today";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlayerView =
  | { workout: WorkoutSummary; state: "ok"; embedUrl: string }
  | { workout: WorkoutSummary; state: "locked" | "broken" };

/** Workout metadata plus its embed when the viewer may watch it. RLS decides both. */
export async function getWorkoutForPlayer(db: TypedClient, workoutId: string): Promise<PlayerView | null> {
  if (!UUID.test(workoutId)) return null;
  const [{ data: row }, { data: media }] = await Promise.all([
    db.from("workouts").select(WORKOUT_COLUMNS).eq("id", workoutId).maybeSingle(),
    db.from("workout_media").select("video_url").eq("workout_id", workoutId).maybeSingle(),
  ]);
  if (!row) return null;
  const workout = toSummary(row);
  if (!media) return { workout, state: "locked" };
  const ref = parseVideoUrl(media.video_url);
  return ref ? { workout, state: "ok", embedUrl: ref.embedUrl } : { workout, state: "broken" };
}

/** Every published workout the viewer can see, newest first. */
export async function listPublishedWorkouts(db: TypedClient): Promise<WorkoutSummary[]> {
  const { data, error } = await db.from("workouts").select(WORKOUT_COLUMNS).order("publish_at", { ascending: false });
  if (error) throw new Error(`list workouts failed: ${error.message}`);
  return data.map(toSummary);
}
```

`src/server/content/completion.ts`:

```ts
import { AppError } from "@/lib/app-error";
import type { TypedClient } from "@/server/db/types";

type Feeling = "easy" | "right" | "hard";

/** Records „Завърших". A second tap the same day returns the existing completion. */
export async function markWorkoutComplete(
  db: TypedClient,
  workoutId: string,
): Promise<{ status: "done" | "already"; completionId: string }> {
  const inserted = await db.from("workout_completions").insert({ workout_id: workoutId }).select("id").single();
  if (!inserted.error) return { status: "done", completionId: inserted.data.id };

  if (inserted.error.code === "23505") {
    const { data } = await db
      .from("workout_completions")
      .select("id")
      .eq("workout_id", workoutId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();
    if (data) return { status: "already", completionId: data.id };
  }
  if (inserted.error.code === "42501") {
    throw new AppError("FORBIDDEN", "Тази тренировка се отключва с абонамент.");
  }
  throw new Error(`complete workout failed: ${inserted.error.message}`);
}

export async function setCompletionFeeling(db: TypedClient, completionId: string, feeling: Feeling): Promise<void> {
  const { error } = await db.from("workout_completions").update({ feeling }).eq("id", completionId);
  if (error) throw new Error(`set feeling failed: ${error.message}`);
}
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/completion.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 3: Server actions**

`src/app/app/workout/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import { markWorkoutComplete, setCompletionFeeling } from "@/server/content/completion";

export async function completeWorkout(workoutId: string): Promise<ActionResult<{ completionId: string }>> {
  try {
    const { supabase } = await requireUser();
    const { completionId } = await markWorkoutComplete(supabase, z.uuid().parse(workoutId));
    revalidatePath("/app");
    return actionOk({ completionId });
  } catch (error) {
    return actionFail(error);
  }
}

export async function rateWorkout(completionId: string, feeling: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await setCompletionFeeling(supabase, z.uuid().parse(completionId), z.enum(["easy", "right", "hard"]).parse(feeling));
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
```

- [ ] **Step 4: Player component**

`src/components/workout/player.tsx`:

```tsx
"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { completeWorkout, rateWorkout } from "@/app/app/workout/[id]/actions";
import { Button } from "@/components/ui/button";
import { FEELING_LABEL } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";

type Phase = "watching" | "rating" | "done";

/**
 * „Завърших" unlocks after `unlockAfterSec` of visible playback time (70% of the
 * workout length). Time only counts while the tab is visible.
 */
export function Player({
  workout,
  embedUrl,
  first,
  unlockAfterSec,
}: {
  workout: WorkoutSummary;
  embedUrl: string;
  first: boolean;
  unlockAfterSec: number;
}) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("watching");
  const [completionId, setCompletionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unlocked = elapsed >= unlockAfterSec;
  const remainingMin = Math.max(1, Math.ceil((unlockAfterSec - elapsed) / 60));

  async function finish() {
    setError("");
    const result = await completeWorkout(workout.id);
    if (!result.ok) return setError(result.message);
    setCompletionId(result.data.completionId);
    setPhase("rating");
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.7 }, colors: ["#e4572e", "#161412", "#d29a1e", "#f4efe8"] });
  }

  async function rate(feeling: keyof typeof FEELING_LABEL) {
    if (completionId) await rateWorkout(completionId, feeling);
    if (first) return router.push("/app/plan?after=first");
    setPhase("done");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-ink text-paper">
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/app" className="text-sm font-semibold text-paper/70">← Назад</Link>
        <p className="text-sm text-paper/60">{workout.durationMin} мин</p>
      </div>
      <div className="aspect-video w-full bg-black">
        <iframe
          src={embedUrl}
          title={workout.title}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <section className="flex flex-1 flex-col justify-between gap-6 px-5 py-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold leading-tight">{workout.title}</h1>
          {workout.description && <p className="text-paper/70">{workout.description}</p>}
        </div>
        <AnimatePresence mode="wait">
          {phase === "watching" && (
            <motion.div key="w" exit={{ opacity: 0, y: 10 }} className="space-y-2">
              <Button onClick={finish} disabled={!unlocked} className="w-full">
                {unlocked ? "Завърших!" : `Завърших (след ~${remainingMin} мин)`}
              </Button>
              {error && <p role="alert" className="text-center text-sm text-ember">{error}</p>}
            </motion.div>
          )}
          {phase === "rating" && (
            <motion.div key="r" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <p className="text-center font-display text-xl font-bold">Браво! Как беше?</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FEELING_LABEL) as Array<keyof typeof FEELING_LABEL>).map((f) => (
                  <Button key={f} variant="quiet" size="md" className="bg-paper/10 text-paper" onClick={() => rate(f)}>
                    {FEELING_LABEL[f]}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}
          {phase === "done" && (
            <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-center">
              <p className="font-display text-xl font-bold">Отбелязано. Ще се видим на следващата!</p>
              <Link href="/app" className="underline underline-offset-4">Към „Днес"</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Player page**

`src/app/app/workout/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { Player } from "@/components/workout/player";
import { WorkoutCover } from "@/components/workout/workout-cover";
import { requireUser } from "@/server/auth/require-user";
import { getWorkoutForPlayer } from "@/server/content/workouts";

export default async function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ first?: string }>;
}) {
  const [{ id }, { first }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireUser();
  const result = await getWorkoutForPlayer(supabase, id);
  if (!result) notFound();

  if (result.state === "broken") {
    return (
      <main className="space-y-4 px-5 pt-8">
        <h1 className="font-display text-2xl font-bold">{result.workout.title}</h1>
        <p className="text-ink-soft">Видеото се обновява. Опитай пак след малко или избери друга тренировка.</p>
        <Link href="/app/library" className={buttonClass("quiet", "md")}>Към библиотеката</Link>
      </main>
    );
  }

  if (result.state === "locked") {
    return (
      <main className="space-y-6 px-5 pt-8">
        <WorkoutCover level={result.workout.level} kind={result.workout.kind} title={result.workout.title} className="h-48 rounded-[2rem]" />
        <h1 className="font-display text-2xl font-bold">{result.workout.title}</h1>
        <p className="text-ink-soft">Тази тренировка се отключва с абонамента.</p>
        <Link href="/app/plan" className={buttonClass("primary", "lg") + " w-full"}>Отключи всички тренировки</Link>
      </main>
    );
  }

  return (
    <Player
      workout={result.workout}
      embedUrl={result.embedUrl}
      first={first === "1"}
      unlockAfterSec={Math.round(result.workout.durationMin * 60 * 0.7)}
    />
  );
}
```

- [ ] **Step 6: Verify in the browser**

As the Task 10 user (no access) open `/app/workout/<free-id>?first=1` at mobile size: dark full-screen player, YouTube embed loads (youtube-nocookie), button disabled with „след ~N мин". To check the unlock without waiting, run `node --env-file=.env.local scripts/dev-set-duration.mjs 1` (≈42 s unlock), reload, wait, click „Завърших!" → confetti + feeling buttons → choose one → lands on `/app/plan?after=first` (404 until Task 14). Restore `duration_min` to 20 afterwards (`pnpm db:reset` also restores). Open a regular workout URL → locked screen, no iframe in the DOM (`find` for `iframe` returns nothing).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: full-screen workout player with completion, feeling and confetti"
```

---

### Task 13: Library

**Files:**
- Create: `src/lib/program/library-filter.ts`, `src/lib/program/library-filter.test.ts`, `src/app/app/library/page.tsx`

**Interfaces:**
- Consumes: `listPublishedWorkouts`, `WorkoutCard`, `FOCUS`, `FOCUS_LABEL`, `LEVEL_LABEL`, `WorkoutSummary`.
- Produces: `interface LibraryFilter { level?: Level; length?: "short" | "mid" | "long"; focus?: Focus }`; `parseLibraryFilter(params: Record<string, string | string[] | undefined>): LibraryFilter`; `filterLibrary(workouts: WorkoutSummary[], f: LibraryFilter): WorkoutSummary[]`.

- [ ] **Step 1: Write the failing tests**

`src/lib/program/library-filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { WorkoutSummary } from "@/server/content/today";
import { filterLibrary, parseLibraryFilter } from "./library-filter";

const w = (over: Partial<WorkoutSummary>): WorkoutSummary => ({
  id: crypto.randomUUID(), title: "t", description: "", kind: "regular", level: "beginner", durationMin: 20,
  focus: ["core"], thumbnailUrl: null, publishAt: "2026-10-01T00:00:00Z", starterOrder: null, ...over,
});

describe("parseLibraryFilter", () => {
  it("keeps only known values", () => {
    expect(parseLibraryFilter({ level: "pro", length: "short", focus: "core" })).toEqual({ level: "pro", length: "short", focus: "core" });
    expect(parseLibraryFilter({ level: "god", length: ["mid", "long"], focus: "<script>" })).toEqual({});
  });
});

describe("filterLibrary", () => {
  const all = [
    w({ id: "a", level: "beginner", durationMin: 15, focus: ["core"] }),
    w({ id: "b", level: "pro", durationMin: 40, focus: ["cardio"] }),
    w({ id: "c", kind: "starter", level: null, durationMin: 25, focus: ["stretch"] }),
  ];

  it("filters by level, length and focus together", () => {
    expect(filterLibrary(all, { level: "beginner" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterLibrary(all, { length: "long" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterLibrary(all, { length: "mid", focus: "stretch" }).map((x) => x.id)).toEqual(["c"]);
  });

  it("returns everything with no filter", () => {
    expect(filterLibrary(all, {})).toHaveLength(3);
  });
});
```

Run: `pnpm test src/lib/program/library-filter` → FAIL (module not found).

- [ ] **Step 2: Implement**

`src/lib/program/library-filter.ts`:

```ts
import { FOCUS, type Focus } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";
import type { Level } from "./types";

export interface LibraryFilter {
  level?: Level;
  length?: "short" | "mid" | "long";
  focus?: Focus;
}

const LEVELS: readonly Level[] = ["beginner", "advanced", "pro"];
const LENGTHS = ["short", "mid", "long"] as const;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function parseLibraryFilter(params: Record<string, string | string[] | undefined>): LibraryFilter {
  const filter: LibraryFilter = {};
  const level = one(params.level);
  const length = one(params.length);
  const focus = one(params.focus);
  if (level && (LEVELS as readonly string[]).includes(level)) filter.level = level as Level;
  if (length && (LENGTHS as readonly string[]).includes(length)) filter.length = length as LibraryFilter["length"];
  if (focus && (FOCUS as readonly string[]).includes(focus)) filter.focus = focus as Focus;
  return filter;
}

function lengthOf(min: number): LibraryFilter["length"] {
  return min <= 15 ? "short" : min <= 30 ? "mid" : "long";
}

export function filterLibrary(workouts: WorkoutSummary[], f: LibraryFilter): WorkoutSummary[] {
  return workouts.filter(
    (w) =>
      (!f.level || w.level === f.level) &&
      (!f.length || lengthOf(w.durationMin) === f.length) &&
      (!f.focus || w.focus.includes(f.focus)),
  );
}
```

Run: `pnpm test src/lib/program/library-filter` → PASS.

- [ ] **Step 3: Library page**

`src/app/app/library/page.tsx`:

```tsx
import Link from "next/link";
import { WorkoutCard } from "@/components/workout/workout-card";
import { cn } from "@/lib/cn";
import { FOCUS, FOCUS_LABEL, LEVEL_LABEL } from "@/lib/labels";
import { filterLibrary, parseLibraryFilter, type LibraryFilter } from "@/lib/program/library-filter";
import { requireUser } from "@/server/auth/require-user";
import { listPublishedWorkouts } from "@/server/content/workouts";

export const metadata = { title: "Библиотека" };

const LENGTH_LABEL = { short: "до 15 мин", mid: "16–30 мин", long: "30+ мин" } as const;

function chipHref(current: LibraryFilter, key: keyof LibraryFilter, value: string) {
  const next = new URLSearchParams(Object.entries(current) as [string, string][]);
  if (current[key] === value) next.delete(key);
  else next.set(key, value);
  const query = next.toString();
  return query ? `/app/library?${query}` : "/app/library";
}

function Chips({ filter, keyName, options }: { filter: LibraryFilter; keyName: keyof LibraryFilter; options: Record<string, string> }) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {Object.entries(options).map(([value, label]) => (
        <Link
          key={value}
          href={chipHref(filter, keyName, value)}
          className={cn(
            "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold",
            filter[keyName] === value ? "border-ink bg-ink text-paper" : "border-line bg-white",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filter = parseLibraryFilter(await searchParams);
  const { supabase } = await requireUser();
  const [workouts, { data: hasAccess }] = await Promise.all([listPublishedWorkouts(supabase), supabase.rpc("my_access")]);
  const shown = filterLibrary(workouts, filter);

  return (
    <main className="space-y-5 px-5 pt-8">
      <h1 className="font-display text-3xl font-bold">Библиотека</h1>
      <Chips filter={filter} keyName="level" options={LEVEL_LABEL} />
      <Chips filter={filter} keyName="length" options={LENGTH_LABEL} />
      <Chips filter={filter} keyName="focus" options={Object.fromEntries(FOCUS.map((f) => [f, FOCUS_LABEL[f]]))} />
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-ink/5 p-5 text-ink-soft">Няма тренировки с тези филтри.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((w) => (
            <WorkoutCard key={w.id} workout={w} locked={!hasAccess && w.kind !== "free"} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Verify in the browser**

`/app/library` at mobile size: three horizontally scrollable chip rows, tapping a chip filters and highlights it, tapping again clears it; without access every card except the free one shows „🔒 С абонамент" and links to `/app/plan`; `?level=<script>` shows the unfiltered list.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: workout library with level, length and focus filters"
```

---

### Task 14: „Твоят план" offer screen

**Files:**
- Create: `src/app/app/plan/page.tsx`, `src/lib/format.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `buildPlanSummary`, `requireUser`, `Goal`, `Time`, `LEVEL_LABEL`.
- Produces: `formatPrice(cents: number, currency: string): string` (bg-BG, e.g. `19,90 €`). The checkout button is wired in plan 1C; here it renders disabled with „Плащането се включва скоро".

- [ ] **Step 1: Failing price test**

`src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("formats euro cents the Bulgarian way", () => {
    expect(formatPrice(1990, "EUR").replace(/ /g, " ")).toBe("19,90 €");
    expect(formatPrice(14900, "EUR").replace(/ /g, " ")).toBe("149,00 €");
  });
});
```

Run: `pnpm test src/lib/format` → FAIL.

- [ ] **Step 2: Implement**

`src/lib/format.ts`:

```ts
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(cents / 100);
}
```

Run: `pnpm test src/lib/format` → PASS.

- [ ] **Step 3: Plan page**

`src/app/app/plan/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { LEVEL_LABEL, type Goal, type Time } from "@/lib/labels";
import { buildPlanSummary } from "@/lib/onboarding/plan-summary";
import { requireUser } from "@/server/auth/require-user";

export const metadata = { title: "Твоят план" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const { after } = await searchParams;
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: plans }, { data: hasAccess }] = await Promise.all([
    supabase.from("profiles").select("name, goal, problems, time_per_session, level").eq("id", user.id).single(),
    supabase.from("plans").select("id, name, interval, price_cents, currency").eq("active", true).order("sort"),
    supabase.rpc("my_access"),
  ]);
  if (!profile) redirect("/start");
  if (hasAccess) redirect("/app");

  const summary = buildPlanSummary({
    goal: profile.goal as Goal | null,
    problems: profile.problems,
    time: profile.time_per_session as Time | null,
    level: profile.level,
  });
  const monthly = plans?.find((p) => p.interval === "month");

  return (
    <main className="space-y-8 px-5 pt-8">
      {after === "first" && (
        <p className="inline-block rounded-full bg-moss px-4 py-1.5 text-sm font-bold text-white">Първата тренировка е направена ✓</p>
      )}
      <header className="space-y-3">
        <p className="text-sm font-semibold text-ink-soft">Твоят план, {profile.name.split(" ")[0]}</p>
        <h1 className="font-display text-4xl font-black leading-[0.95]">{summary.headline}</h1>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          [String(summary.perWeek), "пъти седмично"],
          [summary.minutes.replace(" минути", ""), "минути"],
          [LEVEL_LABEL[profile.level], "ниво"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-3xl bg-white p-4 ring-1 ring-line">
            <dt className="sr-only">{label}</dt>
            <dd className="font-display text-xl font-bold">{value}</dd>
            <dd className="text-xs text-ink-soft">{label}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <h2 className="font-semibold">Фокус</h2>
        <div className="flex flex-wrap gap-2">
          {summary.focus.map((f) => (
            <span key={f} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">{f}</span>
          ))}
        </div>
      </section>

      <ul className="space-y-3 text-[15px]">
        <li>✓ Стартова седмица, за да влезеш в ритъм без мускулна треска</li>
        <li>✓ Нови тренировки за твоето ниво всяка седмица</li>
        <li>✓ Цялата библиотека, по всяко време</li>
        <li>✓ Проследяване на тегло, мерки и серии</li>
      </ul>

      <section className="space-y-3">
        {(plans ?? []).map((plan) => (
          <div key={plan.id} className="flex items-center justify-between rounded-3xl border-2 border-ink bg-white p-5">
            <div>
              <p className="font-display text-lg font-bold">{plan.name}</p>
              {plan.interval === "year" && monthly && (
                <p className="text-sm text-moss">
                  {formatPrice(Math.round(plan.price_cents / 12), plan.currency)} на месец
                </p>
              )}
            </div>
            <p className="font-display text-xl font-bold">
              {formatPrice(plan.price_cents, plan.currency)}
              <span className="text-sm font-medium text-ink-soft">/{plan.interval === "month" ? "мес" : "год"}</span>
            </p>
          </div>
        ))}
        {/* Wired to checkout in plan 1C. */}
        <Button disabled className="w-full">Плащането се включва скоро</Button>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Finish the free workout as a no-access user → `/app/plan?after=first`: green badge, headline from the goal, three stat tiles, focus chips from the chosen problems, both seed plans with `19,90 €` and `149,00 €` (+ „12,42 € на месец"). With access granted, `/app/plan` redirects to `/app`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: personal plan and offer screen"
```

---

### Task 15: Profile, check-ins, data export and account deletion

**Files:**
- Create: `src/server/profile/profile.ts`, `supabase/tests/profile.test.ts`, `src/app/app/profile/page.tsx`, `src/app/app/profile/profile-forms.tsx`, `src/app/app/profile/actions.ts`, `src/app/app/check-in/page.tsx`, `src/app/app/check-in/actions.ts`, `src/app/api/me/export/route.ts`, `src/components/progress/sparkline.tsx`, `src/lib/progress/check-in-schema.ts`, `src/lib/progress/check-in-schema.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `createAdminSupabaseClient`, `TypedClient`, `LEVEL_LABEL`, `actionOk/actionFail`, `AppError`.
- Produces:
  - `checkInSchema` (zod; all optional numbers, at least one value) → `CheckInInput`
  - `updateProfileBasics(db, userId, input: { name: string; level: Level }): Promise<void>`
  - `addCheckIn(db, input: CheckInInput): Promise<void>`
  - `exportMyData(db, userId): Promise<Record<string, unknown>>`
  - `deleteAccount(admin: TypedClient, userId: string): Promise<void>`
  - actions `saveProfile(form)`, `signOut()`, `deleteMyAccount(form)`, `saveCheckIn(form)`
  - `<Sparkline points={number[]} />`

- [ ] **Step 1: Failing check-in schema test**

`src/lib/progress/check-in-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkInSchema } from "./check-in-schema";

describe("checkInSchema", () => {
  it("parses form strings into numbers and drops blanks", () => {
    expect(checkInSchema.parse({ weight_kg: "64,5", waist_cm: "", hips_cm: "", energy: "4", mood: "", note: "" })).toEqual({
      weight_kg: 64.5,
      energy: 4,
    });
  });

  it("rejects a completely empty check-in", () => {
    expect(checkInSchema.safeParse({ weight_kg: "", waist_cm: "", hips_cm: "", energy: "", mood: "", note: " " }).success).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(checkInSchema.safeParse({ weight_kg: "500" }).success).toBe(false);
    expect(checkInSchema.safeParse({ energy: "7" }).success).toBe(false);
  });
});
```

Run: `pnpm test src/lib/progress` → FAIL.

- [ ] **Step 2: Implement the schema**

`src/lib/progress/check-in-schema.ts`:

```ts
import { z } from "zod";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const decimal = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => {
      const b = blankToUndefined(v);
      return typeof b === "string" ? Number(b.replace(",", ".")) : b;
    },
    z.number({ error: message }).min(min, message).max(max, message).optional(),
  );
const scale = z.preprocess((v) => {
  const b = blankToUndefined(v);
  return typeof b === "string" ? Number(b) : b;
}, z.number().int().min(1).max(5).optional());

export const checkInSchema = z
  .object({
    weight_kg: decimal(30, 250, "Теглото е между 30 и 250 кг"),
    waist_cm: decimal(40, 200, "Талията е между 40 и 200 см"),
    hips_cm: decimal(50, 220, "Ханшът е между 50 и 220 см"),
    energy: scale,
    mood: scale,
    note: z.preprocess(blankToUndefined, z.string().trim().max(500).optional()),
  })
  .transform((v) => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as Partial<typeof v>)
  .refine((v) => Object.keys(v).length > 0, { message: "Попълни поне едно поле." });

export type CheckInInput = z.infer<typeof checkInSchema>;
```

Run: `pnpm test src/lib/progress` → PASS.

- [ ] **Step 3: Failing profile service tests**

`supabase/tests/profile.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { addCheckIn, deleteAccount, exportMyData, updateProfileBasics } from "@/server/profile/profile";
import { adminClient, createUser, freeWorkoutId, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("profile services", () => {
  it("updates name and level", async () => {
    const user = await createUser(admin, "basics");
    await updateProfileBasics(await signedInClient(user), user.id, { name: "Ива", level: "pro" });
    const { data } = await admin.from("profiles").select("name, level").eq("id", user.id).single();
    expect(data).toEqual({ name: "Ива", level: "pro" });
  });

  it("exports the user's own data", async () => {
    const user = await createUser(admin, "export");
    const db = await signedInClient(user);
    await addCheckIn(db, { weight_kg: 63 });
    await db.from("workout_completions").insert({ workout_id: await freeWorkoutId(admin) });
    const data = await exportMyData(db, user.id);
    expect(data.profile).toMatchObject({ id: user.id });
    expect(data.check_ins).toHaveLength(1);
    expect(data.workout_completions).toHaveLength(1);
  });

  it("deletes the account and every row that belongs to it", async () => {
    const user = await createUser(admin, "delete");
    await addCheckIn(await signedInClient(user), { energy: 3 });
    await deleteAccount(admin, user.id);
    const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id);
    const { data: checkIns } = await admin.from("check_ins").select("id").eq("user_id", user.id);
    expect(profile).toEqual([]);
    expect(checkIns).toEqual([]);
  });
});
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/profile.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement the services**

`src/server/profile/profile.ts`:

```ts
import type { CheckInInput } from "@/lib/progress/check-in-schema";
import type { Level } from "@/lib/program/types";
import type { TypedClient } from "@/server/db/types";

export async function updateProfileBasics(db: TypedClient, userId: string, input: { name: string; level: Level }): Promise<void> {
  const { error } = await db.from("profiles").update({ name: input.name, level: input.level }).eq("id", userId);
  if (error) throw new Error(`update profile failed: ${error.message}`);
}

export async function addCheckIn(db: TypedClient, input: CheckInInput): Promise<void> {
  const { error } = await db.from("check_ins").insert(input);
  if (error) throw new Error(`check-in failed: ${error.message}`);
}

/** Everything stored about the signed-in user (GDPR access right). */
export async function exportMyData(db: TypedClient, userId: string): Promise<Record<string, unknown>> {
  const [profile, completions, checkIns, subscription] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).single(),
    db.from("workout_completions").select("workout_id, completed_at, local_date, feeling").eq("user_id", userId),
    db.from("check_ins").select("created_at, weight_kg, waist_cm, hips_cm, energy, mood, note").eq("user_id", userId),
    db.from("subscriptions").select("status, current_period_end, provider").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    workout_completions: completions.data ?? [],
    check_ins: checkIns.data ?? [],
    subscription: subscription.data,
  };
}

/** Removes the auth user; profile and all owned rows cascade. Needs the service-role client. */
export async function deleteAccount(admin: TypedClient, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete account failed: ${error.message}`);
}
```

Run: `DOCKER_CONFIG=/tmp/dockercfg pnpm test:db supabase/tests/profile.test.ts` → PASS (3 tests).

- [ ] **Step 5: Actions and export route**

`src/app/app/profile/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { deleteAccount, updateProfileBasics } from "@/server/profile/profile";

const basicsSchema = z.object({
  name: z.string().trim().min(1, "Името е задължително").max(60),
  level: z.enum(["beginner", "advanced", "pro"]),
});

export async function saveProfile(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    await updateProfileBasics(supabase, user.id, basicsSchema.parse(Object.fromEntries(form)));
    revalidatePath("/app", "layout");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function signOut(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteMyAccount(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    if (form.get("confirm") !== "ИЗТРИЙ") throw new AppError("INVALID", "Напиши ИЗТРИЙ, за да потвърдиш.");
    const { user, supabase } = await requireUser();
    await deleteAccount(createAdminSupabaseClient(), user.id);
    await supabase.auth.signOut();
  } catch (error) {
    return actionFail(error);
  }
  redirect("/?deleted=1");
}
```

`src/app/app/check-in/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { actionFail, type ActionResult } from "@/lib/action-result";
import { checkInSchema } from "@/lib/progress/check-in-schema";
import { requireUser } from "@/server/auth/require-user";
import { addCheckIn } from "@/server/profile/profile";

export async function saveCheckIn(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await addCheckIn(supabase, checkInSchema.parse(Object.fromEntries(form)));
  } catch (error) {
    return actionFail(error);
  }
  redirect("/app/profile?saved=1");
}
```

`src/app/api/me/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isAppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { exportMyData } from "@/server/profile/profile";

export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const data = await exportMyData(supabase, user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="moite-danni-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = isAppError(error) && error.code === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: "export failed" }, { status });
  }
}
```

- [ ] **Step 6: Sparkline and pages**

`src/components/progress/sparkline.tsx`:

```tsx
/** Minimal SVG line for a handful of points (oldest → newest). */
export function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return <p className="text-sm text-ink-soft">Добави още едно измерване, за да видиш графика.</p>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * 100},${36 - ((p - min) / span) * 32}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-20 w-full" role="img" aria-label={label} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--color-ember)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
```

`src/app/app/check-in/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveCheckIn } from "./actions";

function Scale({ name, label, faces }: { name: string; label: string; faces: string[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {faces.map((face, i) => (
          <label key={face} className="cursor-pointer">
            <input type="radio" name={name} value={i + 1} className="peer sr-only" />
            <span className={cn("flex h-14 items-center justify-center rounded-2xl border-2 border-line bg-white text-2xl transition-all", "peer-checked:border-ink peer-checked:bg-ink/5 peer-checked:scale-105")}>
              {face}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CheckInPage() {
  const [state, action, pending] = useActionState(saveCheckIn, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <main className="space-y-6 px-5 pt-8">
      <h1 className="font-display text-3xl font-bold">Как си днес?</h1>
      <form action={action} className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Тегло, кг" error={errors.weight_kg}>
            <input name="weight_kg" inputMode="decimal" className={inputClass} />
          </Field>
          <Field label="Талия, см" error={errors.waist_cm}>
            <input name="waist_cm" inputMode="decimal" className={inputClass} />
          </Field>
          <Field label="Ханш, см" error={errors.hips_cm}>
            <input name="hips_cm" inputMode="decimal" className={inputClass} />
          </Field>
        </div>
        <Scale name="energy" label="Енергия" faces={["🪫", "😮‍💨", "🙂", "💪", "⚡️"]} />
        <Scale name="mood" label="Настроение" faces={["😞", "😕", "😐", "😊", "🤩"]} />
        <Field label="Бележка (по желание)">
          <textarea name="note" maxLength={500} rows={3} className={inputClass + " h-auto py-3"} />
        </Field>
        {state && !state.ok && <p role="alert" className="text-brick">{state.message}</p>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Запазвам…" : "Запази"}</Button>
      </form>
    </main>
  );
}
```

`src/app/app/profile/page.tsx`:

```tsx
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Sparkline } from "@/components/progress/sparkline";
import { LEVEL_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/auth/require-user";
import { ProfileForms } from "./profile-forms";
import { signOut } from "./actions";

export const metadata = { title: "Профил" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { user, supabase } = await requireUser();
  const [{ data: profile }, { data: checkIns }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("name, email, level, weight_kg, target_weight_kg").eq("id", user.id).single(),
    supabase.from("check_ins").select("created_at, weight_kg, waist_cm").eq("user_id", user.id).order("created_at").limit(30),
    supabase.from("subscriptions").select("status, current_period_end").eq("user_id", user.id).maybeSingle(),
  ]);
  const weights = (checkIns ?? []).map((c) => c.weight_kg).filter((w): w is number => w !== null);
  const waists = (checkIns ?? []).map((c) => c.waist_cm).filter((w): w is number => w !== null);

  return (
    <main className="space-y-8 px-5 pt-8">
      <header>
        <h1 className="font-display text-3xl font-bold">{profile?.name}</h1>
        <p className="text-ink-soft">{profile?.email} · {profile ? LEVEL_LABEL[profile.level] : ""}</p>
      </header>
      {saved && <p className="rounded-2xl bg-moss/15 px-4 py-3 font-semibold text-moss">Прогресът е записан ✓</p>}

      <section className="space-y-3 rounded-[1.75rem] bg-white p-5 ring-1 ring-line">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Тегло</h2>
          <p className="text-sm text-ink-soft">
            {weights.at(-1) ?? profile?.weight_kg ?? "—"} кг · цел {profile?.target_weight_kg ?? "—"} кг
          </p>
        </div>
        <Sparkline points={weights} label="Тегло във времето" />
        {waists.length > 1 && (
          <>
            <h2 className="pt-2 font-semibold">Талия</h2>
            <Sparkline points={waists} label="Талия във времето" />
          </>
        )}
        <Link href="/app/check-in" className={buttonClass("ghost", "md") + " w-full"}>Отбележи прогрес</Link>
      </section>

      <section className="space-y-2 rounded-[1.75rem] bg-white p-5 ring-1 ring-line">
        <h2 className="font-semibold">Абонамент</h2>
        <p className="text-ink-soft">
          {sub && ["active", "trialing"].includes(sub.status) ? "Активен" : "Нямаш активен абонамент"}
        </p>
        {!sub && <Link href="/app/plan" className="font-semibold underline underline-offset-4">Виж плановете</Link>}
      </section>

      {profile && <ProfileForms name={profile.name} level={profile.level} />}

      <section className="space-y-3">
        <a href="/api/me/export" className={buttonClass("quiet", "md") + " w-full"}>Изтегли моите данни</a>
        <form action={signOut}>
          <button className={buttonClass("quiet", "md") + " w-full"}>Изход</button>
        </form>
      </section>
    </main>
  );
}
```

Create `src/app/app/profile/profile-forms.tsx` (client part: basics form + delete form):

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level } from "@/lib/program/types";
import { deleteMyAccount, saveProfile } from "./actions";

export function ProfileForms({ name, level }: { name: string; level: Level }) {
  const [saveState, save, saving] = useActionState(saveProfile, null);
  const [deleteState, remove, removing] = useActionState(deleteMyAccount, null);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <form action={save} className="space-y-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-line">
        <h2 className="font-semibold">Данни</h2>
        <Field label="Име">
          <input name="name" defaultValue={name} className={inputClass} />
        </Field>
        <Field label="Ниво" hint="Можеш да го сменяш по всяко време.">
          <select name="level" defaultValue={level} className={inputClass}>
            {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
              <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
            ))}
          </select>
        </Field>
        {saveState && (saveState.ok ? <p className="text-moss">Запазено ✓</p> : <p className="text-brick">{saveState.message}</p>)}
        <Button type="submit" size="md" disabled={saving} className="w-full">Запази</Button>
      </form>

      <section className="space-y-3">
        {!showDelete ? (
          <button type="button" onClick={() => setShowDelete(true)} className="text-sm text-brick underline underline-offset-4">
            Изтрий профила ми
          </button>
        ) : (
          <form action={remove} className="space-y-3 rounded-[1.75rem] border-2 border-brick p-5">
            <p className="text-sm">Това изтрива профила, тренировките и прогреса ти завинаги. Напиши <strong>ИЗТРИЙ</strong>:</p>
            <input name="confirm" className={inputClass} autoComplete="off" />
            {deleteState && !deleteState.ok && <p className="text-sm text-brick">{deleteState.message}</p>}
            <Button type="submit" size="md" disabled={removing} className="w-full bg-brick shadow-none">Изтрий завинаги</Button>
          </form>
        )}
      </section>
    </>
  );
}
```

- [ ] **Step 7: Verify in the browser**

`/app/check-in`: save `64,5` kg + energy → redirected to `/app/profile?saved=1` with the green note; add a second check-in → sparkline appears. Change level to „Профи" → „Запазено ✓", `/app` header shows „Профи". „Изтегли моите данни" downloads a JSON with profile, completions, check-ins. Delete with wrong text → error; with „ИЗТРИЙ" → lands on `/`, and logging in again fails.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: profile, progress check-ins, data export and account deletion"
```

---

### Task 16: First-party visit tracking

**Files:**
- Create: `src/lib/device.ts`, `src/lib/device.test.ts`, `src/server/visits/record-visit.ts`, `src/app/api/visit/route.ts`, `src/components/app/visit-beacon.tsx`
- Modify: `src/app/layout.tsx` (render `<VisitBeacon />`)

**Interfaces:**
- Consumes: `createAdminSupabaseClient`, `createServerSupabaseClient`.
- Produces: `deviceFromUserAgent(ua: string | null): "mobile" | "tablet" | "desktop"`; `visitSchema` (path ≤ 300, referrer ≤ 500, utm record of the five `utm_*` keys); `recordVisit(admin, { anonId, userId, path, referrer, utm, device })`; `POST /api/visit` (204); cookie `fp_aid` (httpOnly, 1 year, SameSite=Lax).

- [ ] **Step 1: Failing device test**

`src/lib/device.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deviceFromUserAgent } from "./device";

describe("deviceFromUserAgent", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", "mobile"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36", "mobile"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15", "tablet"],
    ["Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36", "tablet"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15", "desktop"],
    [null, "desktop"],
  ])("%s → %s", (ua, expected) => {
    expect(deviceFromUserAgent(ua)).toBe(expected);
  });
});
```

Run: `pnpm test src/lib/device` → FAIL.

- [ ] **Step 2: Implement**

`src/lib/device.ts`:

```ts
export function deviceFromUserAgent(ua: string | null): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop";
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}
```

Run: `pnpm test src/lib/device` → PASS.

- [ ] **Step 3: Service, route, beacon**

`src/server/visits/record-visit.ts`:

```ts
import "server-only";

import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export const visitSchema = z.object({
  path: z.string().startsWith("/").max(300),
  referrer: z.string().max(500).optional().default(""),
  utm: z.partialRecord(z.enum(UTM_KEYS), z.string().max(200)).optional(),
});

export async function recordVisit(
  admin: TypedClient,
  v: { anonId: string; userId: string | null; path: string; referrer: string; utm?: Partial<Record<(typeof UTM_KEYS)[number], string>>; device: "mobile" | "tablet" | "desktop" },
): Promise<void> {
  const { error } = await admin.from("visits").insert({
    anon_id: v.anonId,
    user_id: v.userId,
    path: v.path,
    referrer: v.referrer || null,
    utm: v.utm && Object.keys(v.utm).length ? v.utm : null,
    device: v.device,
  });
  if (error) throw new Error(`record visit failed: ${error.message}`);
  if (v.userId) {
    await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", v.userId);
  }
}
```

`src/app/api/visit/route.ts`:

```ts
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deviceFromUserAgent } from "@/lib/device";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";
import { recordVisit, visitSchema } from "@/server/visits/record-visit";

const COOKIE = "fp_aid";
const UUID = /^[0-9a-f-]{36}$/i;

/** First-party page view. No ad cookies, so it runs regardless of the consent banner. */
export async function POST(request: NextRequest) {
  const parsed = visitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const existing = request.cookies.get(COOKIE)?.value;
  const anonId = existing && UUID.test(existing) ? existing : randomUUID();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    await recordVisit(createAdminSupabaseClient(), {
      anonId,
      userId: user?.id ?? null,
      path: parsed.data.path,
      referrer: parsed.data.referrer,
      utm: parsed.data.utm,
      device: deviceFromUserAgent(request.headers.get("user-agent")),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }

  const response = new NextResponse(null, { status: 204 });
  if (anonId !== existing) {
    response.cookies.set(COOKIE, anonId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  return response;
}
```

`src/components/app/visit-beacon.tsx`:

```tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/** Sends one first-party page view per client-side navigation. */
export function VisitBeacon() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const utm = Object.fromEntries(UTM.filter((k) => params.get(k)).map((k) => [k, params.get(k)!.slice(0, 200)]));
    const body = JSON.stringify({ path: pathname.slice(0, 300), referrer: document.referrer.slice(0, 500), utm });
    if (!navigator.sendBeacon?.("/api/visit", new Blob([body], { type: "application/json" }))) {
      fetch("/api/visit", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, [pathname, params]);

  return null;
}
```

In `src/app/layout.tsx` add the import `import { Suspense } from "react";` and `import { VisitBeacon } from "@/components/app/visit-beacon";` and render inside `<body>` after `{children}`:

```tsx
<Suspense>
  <VisitBeacon />
</Suspense>
```

- [ ] **Step 4: Verify**

Open `/?utm_source=meta&utm_campaign=test`, then `/login`. Check with `read_network_requests` (filter `api/visit`): two POSTs with status 204; the first response sets `fp_aid`. Then query via a small admin-client script or the test helper: the newest two `visits` rows have the same `anon_id`, paths `/` and `/login`, and the first has `utm = {"utm_source":"meta","utm_campaign":"test"}`. A `POST /api/visit` with body `{"path":"no-slash"}` returns 400.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: first-party visit tracking with anonymous id and UTM capture"
```

---

### Task 17: PWA — manifest, icons, service worker, offline page

**Files:**
- Create: `src/app/manifest.ts`, `src/app/pwa-icon/[size]/route.tsx`, `public/sw.js`, `src/components/app/sw-register.tsx`, `src/app/offline/page.tsx`
- Modify: `src/app/layout.tsx` (render `<SwRegister />`, add `icons` to metadata)

**Interfaces:**
- Consumes: `brand`.
- Produces: `/manifest.webmanifest`, `/pwa-icon/192` and `/pwa-icon/512` PNGs, `/sw.js` (navigation fallback; stage 4 adds push handlers here), `/offline`.

- [ ] **Step 1: Manifest and icons**

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.backgroundColor,
    theme_color: brand.themeColor,
    lang: "bg",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

`src/app/pwa-icon/[size]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

const SIZES = new Set([180, 192, 512]);

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: brand.themeColor }}>
        <div style={{ width: size * 0.5, height: size * 0.5, borderRadius: size, border: `${size * 0.09}px solid #e4572e` }} />
      </div>
    ),
    { width: size, height: size },
  );
}
```

In `src/app/layout.tsx` metadata add: `icons: { apple: "/pwa-icon/180" },`.

- [ ] **Step 2: Service worker, registration, offline page**

`public/sw.js`:

```js
// Navigation fallback only. Stage 4 adds push + notificationclick handlers here.
const CACHE = "fp-shell-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const isToday = new URL(request.url).pathname === "/app";
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isToday && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/app", copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE))),
  );
});
```

`src/components/app/sw-register.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
```

`src/app/offline/page.tsx`:

```tsx
export const metadata = { title: "Няма връзка" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl font-bold">Няма връзка</h1>
      <p className="text-ink-soft">Провери интернета и опитай пак. Тренировките са видео и имат нужда от връзка.</p>
    </main>
  );
}
```

In `src/app/layout.tsx` import `SwRegister` and render `<SwRegister />` next to the beacon.

- [ ] **Step 3: Verify with a production build**

```bash
pnpm build && pnpm start
```

Open `http://localhost:3120/manifest.webmanifest` → JSON with `start_url: "/app"` and three icons; `/pwa-icon/512` → PNG. Load `/app` once, then in the browser tool run `navigator.serviceWorker.getRegistration().then(r => r?.active?.state)` → `"activated"`. Stop the server, reload `/app` → cached Today page or the offline page (not the browser's dino error). Restart `pnpm dev` afterwards.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: installable PWA with manifest, icons and offline fallback"
```

---

### Task 18: Full verification of plan 1A

**Files:** none new (fixes only, if something fails).

- [ ] **Step 1: Static checks and all tests**

```bash
export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg
pnpm typecheck && pnpm lint && pnpm test && pnpm db:reset && pnpm test:db && pnpm build
```

Expected: every command exits 0; unit and DB test counts printed with 0 failures. If `prettier --check` fails, run `pnpm format` and re-run.

- [ ] **Step 2: End-to-end walk-through in the browser (mobile preset 375×812)**

1. `/` → „Започни безплатно" → 7 onboarding steps → sign up → free workout player.
2. Free workout → „Завърших!" (after `scripts/dev-set-duration.mjs 1`) → feeling → `/app/plan?after=first` with personalised headline and prices.
3. `/app` shows the locked card; `/app/library` shows locks; a regular workout URL shows the locked screen with no iframe.
4. Grant access (`scripts/dev-grant-access.mjs`) → `/app` shows Starter 1/5; finish all five starters (shortened durations) → `/app` shows the newest beginner workout; week strip ticks today; streak ≥ 1.
5. Check-in twice → sparkline; change level → Today switches level; export downloads JSON; delete account works.
6. Signed-out visit to `/app/library` → `/login?next=%2Fapp%2Flibrary` → after login returns to the library.
7. `read_console_messages` with `onlyErrors: true` → none.

- [ ] **Step 3: Take proof screenshots**

Screenshots of: onboarding step 2, free-workout player, plan screen, Today (subscriber), library. Share them with the user together with the test summary.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore: plan 1A verification fixes"
```

(Skip if nothing changed.)
