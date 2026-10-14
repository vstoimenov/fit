# Fit Platform 1B — Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 2FA-protected admin panel where the owner schedules workouts (several YouTube links at once, by date and time), manages workouts and the starter week, sees clients, their activity and progress, works the "Изостават" list (call / message / note / snooze), reads a dashboard of visits, funnel and subscriptions, edits settings and plans, and can audit every admin change.

**Architecture:** Every admin power is enforced in Postgres: `is_admin()` now requires the `admin` role **and** an `aal2` (TOTP-verified) session, so all admin RLS policies and `security definer` report functions inherit the second factor. Admin pages and server actions additionally call `requireAdmin()` (role + aal2) and use the admin's own session client, never the service role. Every change to workouts, media, plans, subscriptions, settings and roles is written to `audit_log` by DB triggers (actor = `auth.uid()`). Heavy aggregation (client stats, dashboard) lives in two guarded SQL functions; pure decision logic (risk rules, scheduling, time zones, calendar grid, settings validation) lives in `src/lib/admin/*` with unit tests.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents: true`), React 19, TypeScript, Tailwind 4, zod 4, Supabase (Auth MFA TOTP, Postgres RLS, Storage), Vitest, `otpauth` (tests only), Brevo transactional email API.

**Spec:** `docs/superpowers/specs/2026-10-14-fit-platform-stage1-design.md` (§6 Админ панел, §9, §10 2FA + audit log). Follow-ups carried from plan 1A: `docs/superpowers/plans/2026-10-14-fit-platform-1a-followups.md` ("Before / in plan 1B").

## Global Constraints

- Repo `/Users/macbookpro/Downloads/cloude-c/fit-platform`, branch `plan-1b` (created from `main` after the 1A merge).
- Shell: `export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg`. Local Supabase on ports 553xx (API `55321`), container `supabase_db_fit-platform` (never touch `supabase_db_adsnap`). Apply migrations with `pnpm db:reset`, then `pnpm db:types`. Never edit an applied migration.
- Next 16 `cacheComponents: true`: every server page/layout that reads the session or `searchParams` = sync default export → `<Suspense>` → async inner component that calls `await connection()` (from `next/server`) before the session read. `params`/`searchParams` are Promises. Pattern: `src/app/app/page.tsx`.
- **Admin = role `admin` AND aal2.** An admin who has not passed TOTP is treated exactly like a client everywhere (DB, pages, actions). The admin role is only granted manually (SQL / `scripts/make-admin.mjs`), never from the UI.
- Admin code never uses the service-role client; it uses the admin's session client so RLS + audit triggers see the real actor. (The service role stays limited to the existing visits/account-deletion code.)
- **Workouts are never hard-deleted once anyone completed them** (completions cascade); "Скрий" = back to draft (`publish_at = null`). Delete is allowed only for workouts with zero completions.
- Thumbnails are copied into our own Supabase Storage bucket `thumbnails` (random file name); a provider thumbnail URL (which contains the video ID) is never stored.
- Server-side fetches go only to fixed provider endpoints: `https://www.youtube.com/oembed`, `https://vimeo.com/api/oembed.json`, and thumbnail hosts `i.ytimg.com`, `i.vimeocdn.com`. 5 s timeout, images ≤ 2 MB, `image/jpeg|png|webp` only.
- Admin enters dates/times in `Europe/Sofia`; `publish_at` is stored in UTC.
- Secrets (Brevo API key, future CAPI token / GA4 MP secret) live in env vars, never in the `settings` table.
- New tables: revoke `insert, update, delete` (and `select` for anon) from `anon, authenticated`, then grant exactly what the policies need; add each new table to `supabase/tests/privileges.test.ts` `TABLES`.
- Tests must prove properties (assert `error`, and that hidden rows exist via the service role) — never pass vacuously.
- UI copy Bulgarian; code/commits English; commit messages end with a blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Design is intentionally plain (the user deferred the visual redesign): reuse `Button`, `buttonClass`, `Field`, `inputClass`, existing tokens; admin is desktop-first but must not break at 375px.
- Out of scope (later plans): payments/checkout (1C), push/email automations and the notify sending itself (stage 4 — 1B only stores `notify`), tracking/consent/CSP/rate limits/CI (1D), visual redesign, branding editable from settings (brand stays in `src/lib/brand.ts`).

## Review Focus

1. **Admin without the second factor:** a user with role `admin` at `aal1` must get no admin data and no admin writes — not through RLS, not through report RPCs, not through pages or server actions (pinned in Task 1 DB tests and Task 5 guard tests).
2. **DST edges when scheduling:** 07:00 on 26 Oct 2026 in Sofia (after the clocks go back) must become `05:00Z`, 07:00 on 29 Mar 2026 must become `04:00Z` (pinned in Task 4).
3. **Messy bulk paste:** blank lines, duplicates, `youtu.be/ID` without `https://`, and non-video URLs must produce per-line errors while the valid lines still get created (pinned in Task 8 `previewLinks` tests).
4. **Deleting a completed workout:** must be refused with a clear message and leave every completion intact (pinned in Task 2 and Task 7).
5. **Manual access:** granting it over an existing paid subscription must be refused; a manual grant must expire at its end date (pinned in Task 1 and Task 9).

---

## File Structure

```
supabase/migrations/
  20261015100000_admin_security.sql   is_admin() needs aal2; manual access expiry; subscriptions.created_at/canceled_at; profile email sync
  20261015100100_admin_tables.sql     client_notes, audit_log, settings; admin write policies; audit triggers; reorder RPC; thumbnails bucket
  20261015100200_admin_reports.sql    admin_client_stats(), admin_dashboard()
supabase/config.toml                  [auth.mfa.totp] enroll/verify enabled
supabase/tests/
  helpers.ts                          + createAdminUser() (TOTP aal2), aal1 admin helper
  admin-security.test.ts, admin-tables.test.ts, admin-reports.test.ts,
  admin-workouts.test.ts, admin-clients.test.ts, admin-settings.test.ts, admin-thumbnails.test.ts
  privileges.test.ts                  + new tables
scripts/make-admin.mjs                local-only: promote an email to admin
src/lib/
  app-error.ts                        + "MFA_REQUIRED"
  env-schema.ts                       + BREVO_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME (optional)
  form-data.ts (+test)                formString/formInt/formBool/formList
  video/parse-video-url.ts (+test)    scheme-less links, normalizeVideoInput, adversarial cases
  admin/time.ts (+test)               ADMIN_TZ, zonedToUtc, utcToZoned
  admin/schedule.ts (+test)           distributeDates
  admin/calendar.ts (+test)           monthGrid, weekOf, workoutStatus, levelGaps
  admin/risk.ts (+test)               assessRisk, RISK_LABEL
  admin/settings.ts (+test)           SETTINGS schemas, defaults, parseSetting, renderTemplate
src/server/admin/
  require-admin.ts                    requireAdmin()
  video-meta.ts (+test)               fetchVideoMeta()
  thumbnails.ts                       copyThumbnail()
  mailer.ts (+test)                   createMailer() Brevo | console
  workouts.ts                         admin workout CRUD, schedule, move, reorder, bulk
  clients.ts                          listClients, getClientDetail, manual access
  notes.ts                            addNote, recordMessage
  risk.ts                             listAtRisk, sendNudge
  dashboard.ts                        getDashboard
  settings.ts                         getSettings, saveSetting, plans CRUD
  audit.ts                            listAudit
src/components/admin/
  action-form.tsx                     useActionState wrapper with message
  admin-nav.tsx                       sidebar / top nav
  level-badge.tsx, status-badge.tsx
src/app/admin/
  mfa/page.tsx, mfa/mfa-form.tsx      enroll / verify TOTP (role required, aal1 allowed)
  (panel)/layout.tsx                  gate: role + aal2, nav
  (panel)/page.tsx                    dashboard
  (panel)/calendar/{page.tsx, month-view.tsx, bulk-add.tsx, actions.ts}
  (panel)/workouts/{page.tsx, new/page.tsx, [id]/page.tsx, workout-form.tsx, starter-order.tsx, actions.ts}
  (panel)/clients/{page.tsx, [id]/page.tsx, [id]/actions.ts}
  (panel)/activity/page.tsx
  (panel)/at-risk/{page.tsx, risk-actions.tsx, actions.ts}
  (panel)/settings/{page.tsx, forms.tsx, actions.ts}
  (panel)/audit/page.tsx
```

---

### Task 1: Admin security in the database (aal2, manual access expiry, email sync)

**Files:**
- Create: `supabase/migrations/20261015100000_admin_security.sql`, `supabase/tests/admin-security.test.ts`
- Modify: `supabase/config.toml` (`[auth.mfa.totp]`), `supabase/tests/helpers.ts` (+ `createAdminUser`, `createAal1Admin`), every existing DB test that promotes an admin and relies on admin powers, `package.json` (dev dep `otpauth`), `src/lib/supabase/database.types.ts` (regenerate)

**Interfaces:**
- Produces (SQL): `is_admin()` = role admin AND `auth.jwt()->>'aal' = 'aal2'`; `has_active_access()` treats a `manual` subscription with a past `current_period_end` as expired; `subscriptions.created_at timestamptz not null default now()`, `subscriptions.canceled_at timestamptz`; trigger `on_auth_user_email_changed` keeping `profiles.email` in sync.
- Produces (TS test helpers): `createAdminUser(admin: TypedClient, label: string): Promise<{ user: TestUser; db: TypedClient }>` (role admin + verified TOTP, session at aal2); `createAal1Admin(admin, label): Promise<{ user: TestUser; db: TypedClient }>` (role admin, no MFA).

- [ ] **Step 1: Enable TOTP and add the TOTP library**

In `supabase/config.toml` set under `[auth.mfa.totp]`: `enroll_enabled = true` and `verify_enabled = true`. Then:

```bash
pnpm add -D otpauth
pnpm db:stop && pnpm db:start
```

(`config.toml` auth changes need a restart; data is kept.)

- [ ] **Step 2: Test helpers**

Append to `supabase/tests/helpers.ts`:

```ts
import { TOTP } from "otpauth";

/** A user with role admin who has NOT passed the second factor (session at aal1). */
export async function createAal1Admin(
  admin: TypedClient,
  label: string,
): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
  if (error) throw error;
  return { user, db: await signedInClient(user) };
}

/** A real admin: role admin + enrolled and verified TOTP, so the session is aal2. */
export async function createAdminUser(
  admin: TypedClient,
  label: string,
): Promise<{ user: TestUser; db: TypedClient }> {
  const { user, db } = await createAal1Admin(admin, label);
  const { data: factor, error: enrollError } = await db.auth.mfa.enroll({ factorType: "totp" });
  if (enrollError || !factor) throw enrollError ?? new Error("mfa enroll returned nothing");
  const code = new TOTP({ secret: factor.totp.secret }).generate();
  const { error: verifyError } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (verifyError) throw verifyError;
  return { user, db };
}
```

(Move the `import` to the top of the file with the other imports.)

- [ ] **Step 3: Write the failing tests**

`supabase/tests/admin-security.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  createWorkout,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

beforeAll(() => {
  admin = adminClient();
});

describe("is_admin requires the second factor", () => {
  it("gives an aal1 admin nothing beyond her own rows", async () => {
    const other = await createUser(admin, "sec-other");
    const { db } = await createAal1Admin(admin, "sec-aal1");
    const { data: profiles, error } = await db.from("profiles").select("id").eq("id", other.id);
    expect(error).toBeNull();
    expect(profiles).toEqual([]);
    const { data: isAdmin } = await db.rpc("is_admin");
    expect(isAdmin).toBe(false);
    const draft = await createWorkout(admin, { title: "Чернова", kind: "regular", level: "pro", duration_min: 10, publish_at: null });
    const { data: drafts } = await db.from("workouts").select("id").eq("id", draft);
    expect(drafts).toEqual([]);
  });

  it("gives an aal2 admin every profile and drafts", async () => {
    const other = await createUser(admin, "sec-other2");
    const { db } = await createAdminUser(admin, "sec-aal2");
    const { data: isAdmin } = await db.rpc("is_admin");
    expect(isAdmin).toBe(true);
    const { data: profiles, error } = await db.from("profiles").select("id").eq("id", other.id);
    expect(error).toBeNull();
    expect(profiles).toHaveLength(1);
    const draft = await createWorkout(admin, { title: "Чернова 2", kind: "regular", level: "pro", duration_min: 10, publish_at: null });
    const { data: drafts } = await db.from("workouts").select("id").eq("id", draft);
    expect(drafts).toHaveLength(1);
  });
});

describe("manual access", () => {
  async function hasAccess(userId: string): Promise<boolean> {
    const { data, error } = await admin.rpc("has_active_access", { uid: userId });
    expect(error).toBeNull();
    return data === true;
  }

  it("keeps an open-ended manual grant active", async () => {
    const user = await createUser(admin, "man-open");
    await grantAccess(admin, user.id);
    expect(await hasAccess(user.id)).toBe(true);
  });

  it("expires a manual grant at its end date", async () => {
    const live = await createUser(admin, "man-live");
    await grantAccess(admin, live.id, "active", { current_period_end: iso(day) });
    expect(await hasAccess(live.id)).toBe(true);
    const ended = await createUser(admin, "man-ended");
    await grantAccess(admin, ended.id, "active", { current_period_end: iso(-day) });
    expect(await hasAccess(ended.id)).toBe(false);
  });

  it("does not expire a paid active subscription on a stale period end (webhook lag)", async () => {
    const user = await createUser(admin, "paid-lag");
    const { error } = await admin
      .from("subscriptions")
      .upsert({ user_id: user.id, provider: "stripe", status: "active", current_period_end: iso(-day) });
    expect(error).toBeNull();
    expect(await hasAccess(user.id)).toBe(true);
  });
});

describe("profile email sync", () => {
  it("follows an auth email change", async () => {
    const user = await createUser(admin, "mail-sync");
    const next = `renamed-${Date.now()}@example.test`;
    const { error } = await admin.auth.admin.updateUserById(user.id, { email: next, email_confirm: true });
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("email").eq("id", user.id).single();
    expect(data?.email).toBe(next);
  });
});

describe("subscription timestamps", () => {
  it("records created_at and accepts canceled_at", async () => {
    const user = await createUser(admin, "sub-ts");
    await grantAccess(admin, user.id);
    const canceledAt = iso(0);
    const { error } = await admin.from("subscriptions").update({ canceled_at: canceledAt }).eq("user_id", user.id);
    expect(error).toBeNull();
    const { data } = await admin.from("subscriptions").select("created_at, canceled_at").eq("user_id", user.id).single();
    expect(data?.created_at).not.toBeNull();
    expect(data?.canceled_at).not.toBeNull();
  });
});

describe("a client is unaffected", () => {
  it("still reads her own profile", async () => {
    const user = await createUser(admin, "sec-client");
    const db = await signedInClient(user);
    const { data } = await db.from("profiles").select("id");
    expect(data?.map((r) => r.id)).toEqual([user.id]);
  });
});
```

Run: `pnpm test:db supabase/tests/admin-security.test.ts`
Expected: FAIL — `rpc("is_admin")` is true for the aal1 admin, the expired manual grant still has access, `created_at` column missing, profile email not synced.

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261015100000_admin_security.sql`:

```sql
-- Admin powers need the second factor: an admin session that has not passed TOTP (aal1) is a client.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (
       select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
     );
$$;

-- Manual (comp) grants may carry an end date and expire on it. Paid active subscriptions ignore a
-- stale period end, because the provider's renewal webhook can arrive after it.
create or replace function public.has_active_access(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and (
        (
          s.status in ('active', 'trialing')
          and not (
            s.provider = 'manual'
            and s.current_period_end is not null
            and s.current_period_end <= now()
          )
        )
        or (s.status = 'past_due' and s.grace_until > now())
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  );
$$;

alter table public.subscriptions
  add column created_at timestamptz not null default now(),
  add column canceled_at timestamptz;

-- profiles.email is a copy for admin views and email sending; keep it in step with auth.
create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_profile_email();
```

Run: `pnpm db:reset && pnpm db:types`
Expected: reset succeeds; `database.types.ts` has `created_at`/`canceled_at` on `subscriptions`.

- [ ] **Step 5: Run the new tests**

Run: `pnpm test:db supabase/tests/admin-security.test.ts`
Expected: PASS.

- [ ] **Step 6: Move existing admin-power tests to real (aal2) admins**

Run `grep -rn 'role: "admin"' supabase/tests` and, for every test that promotes a user to admin **and then expects admin powers** (reading other users' rows, seeing drafts, etc. — e.g. `profiles.test.ts` "lets an admin read every profile", `activity.test.ts` admin-visibility tests, `completion.test.ts` admin double-tap test, `today.test.ts` admin-draft test, `access.test.ts` admin cases), replace the manual promotion + `signedInClient` with `const { user: boss, db } = await createAdminUser(admin, "<label>")`. Leave tests that assert a user can NOT become admin untouched. Add one assertion to `profiles.test.ts`: an aal1 admin (via `createAal1Admin`) does not see another profile.

Run: `pnpm test:db`
Expected: every DB test file PASSES (the admin-dependent tests now use aal2 sessions; the completion admin test still discriminates the user filter because the aal2 admin sees all rows).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(db): admin powers require TOTP (aal2), expiring manual access, email sync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Admin tables, write policies, audit log, thumbnails bucket

**Files:**
- Create: `supabase/migrations/20261015100100_admin_tables.sql`, `supabase/tests/admin-tables.test.ts`
- Modify: `supabase/tests/privileges.test.ts` (`TABLES` += `audit_log`, `client_notes`, `settings`), `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: `is_admin()` (aal2) from Task 1; helpers `createAdminUser`, `createAal1Admin`.
- Produces (SQL): enum `note_kind ('call','message','note','snooze')`; tables `client_notes(id, user_id, author_id default auth.uid(), kind, body, snooze_until, created_at)`, `audit_log(id, actor_id, action, target_type, target_id, diff, created_at)`, `settings(key, value jsonb, updated_at)`; admin insert/update policies on `workouts`, `workout_media`, `plans`, `settings`, `client_notes`; admin insert/update on `subscriptions` **only for `provider = 'manual'`**; admin delete on `workouts` only without completions, on `workout_media`; function `admin_reorder_starters(p_ids uuid[]) returns void`; audit triggers on `workouts`, `workout_media`, `plans`, `subscriptions`, `settings`, and `profiles` (role changes only); public bucket `thumbnails` (2 MB, jpeg/png/webp) writable by admins.

- [ ] **Step 1: Write the failing tests**

`supabase/tests/admin-tables.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;

beforeAll(async () => {
  admin = adminClient();
  const created = await createAdminUser(admin, "tbl-admin");
  boss = created.db;
  bossId = created.user.id;
});

const workout = (title: string) => ({
  title,
  kind: "regular" as const,
  level: "beginner" as const,
  duration_min: 20,
  publish_at: null,
});

describe("admin writes on workouts", () => {
  it("lets an aal2 admin create, edit and schedule a workout with media", async () => {
    const { data, error } = await boss.from("workouts").insert(workout("Админ тренировка")).select("id").single();
    expect(error).toBeNull();
    const media = await boss
      .from("workout_media")
      .insert({ workout_id: data!.id, provider: "youtube", video_url: "https://youtu.be/ml6cT4AZdqI" });
    expect(media.error).toBeNull();
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const upd = await boss.from("workouts").update({ publish_at: when }).eq("id", data!.id).select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);
  });

  it("refuses the same writes to an aal1 admin and to a client", async () => {
    const { db: half } = await createAal1Admin(admin, "tbl-half");
    const client = await signedInClient(await createUser(admin, "tbl-client"));
    for (const db of [half, client]) {
      const { error } = await db.from("workouts").insert(workout("Не трябва"));
      expect(error?.code).toBe("42501");
    }
  });

  it("deletes an unused workout but refuses one somebody completed", async () => {
    const unused = await createWorkout(admin, workout("Неизползвана"));
    const del = await boss.from("workouts").delete().eq("id", unused).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);

    const freeId = await freeWorkoutId(admin);
    const member = await signedInClient(await createUser(admin, "tbl-done"));
    expect((await member.from("workout_completions").insert({ workout_id: freeId })).error).toBeNull();
    const refused = await boss.from("workouts").delete().eq("id", freeId).select("id");
    expect(refused.error).toBeNull();
    expect(refused.data).toEqual([]);
    const { data: still } = await admin.from("workouts").select("id").eq("id", freeId);
    expect(still).toHaveLength(1);
  });

  it("reorders the starter week in one call", async () => {
    const { data: starters } = await admin.from("workouts").select("id").eq("kind", "starter").order("starter_order");
    const ids = (starters ?? []).map((s) => s.id);
    const reversed = [...ids].reverse();
    const { error } = await boss.rpc("admin_reorder_starters", { p_ids: reversed });
    expect(error).toBeNull();
    const { data: after } = await admin.from("workouts").select("id").eq("kind", "starter").order("starter_order");
    expect(after?.map((s) => s.id)).toEqual(reversed);
    await boss.rpc("admin_reorder_starters", { p_ids: ids });
  });

  it("rejects a reorder that misses or repeats a starter", async () => {
    const { data: starters } = await admin.from("workouts").select("id").eq("kind", "starter");
    const ids = (starters ?? []).map((s) => s.id);
    const dup = await boss.rpc("admin_reorder_starters", { p_ids: [ids[0]!, ...ids.slice(0, -1)] });
    expect(dup.error?.code).toBe("22023");
    const half = await createAal1Admin(admin, "tbl-reorder");
    const denied = await half.db.rpc("admin_reorder_starters", { p_ids: ids });
    expect(denied.error?.code).toBe("42501");
  });
});

describe("subscriptions: manual grants only", () => {
  it("lets an admin create a manual grant", async () => {
    const user = await createUser(admin, "tbl-grant");
    const { error } = await boss
      .from("subscriptions")
      .insert({ user_id: user.id, provider: "manual", status: "active" });
    expect(error).toBeNull();
  });

  it("refuses to touch a paid subscription", async () => {
    const user = await createUser(admin, "tbl-paid");
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "active" });
    const upd = await boss
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id)
      .select("user_id");
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);
    const ins = await boss
      .from("subscriptions")
      .insert({ user_id: (await createUser(admin, "tbl-paid2")).id, provider: "stripe", status: "active" });
    expect(ins.error?.code).toBe("42501");
  });
});

describe("client notes", () => {
  it("records the author automatically and hides notes from clients", async () => {
    const user = await createUser(admin, "tbl-note");
    const { data, error } = await boss
      .from("client_notes")
      .insert({ user_id: user.id, kind: "note", body: "Звъннах, всичко е наред." })
      .select("author_id")
      .single();
    expect(error).toBeNull();
    expect(data?.author_id).toBe(bossId);
    const clientDb = await signedInClient(user);
    const { data: seen } = await clientDb.from("client_notes").select("id");
    expect(seen).toEqual([]);
  });

  it("requires snooze_until exactly for snooze notes", async () => {
    const user = await createUser(admin, "tbl-snooze");
    const bad = await boss.from("client_notes").insert({ user_id: user.id, kind: "snooze" });
    expect(bad.error?.code).toBe("23514");
    const ok = await boss.from("client_notes").insert({
      user_id: user.id,
      kind: "snooze",
      snooze_until: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
    expect(ok.error).toBeNull();
  });
});

describe("audit log", () => {
  it("records who changed what on a workout", async () => {
    const id = await createWorkout(admin, workout("Одит"));
    await boss.from("workouts").update({ title: "Одит 2" }).eq("id", id);
    const { data, error } = await boss
      .from("audit_log")
      .select("actor_id, action, target_type, target_id, diff")
      .eq("target_id", id)
      .eq("action", "update");
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ actor_id: bossId, target_type: "workouts" });
    expect(data?.[0]?.diff).toMatchObject({ title: { from: "Одит", to: "Одит 2" } });
  });

  it("records manual grants and role changes, and hides the log from non-admins", async () => {
    const user = await createUser(admin, "tbl-audit");
    await grantAccess(admin, user.id);
    await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data } = await admin.from("audit_log").select("target_type, action").eq("target_id", user.id);
    expect(data).toEqual(
      expect.arrayContaining([
        { target_type: "subscriptions", action: "insert" },
        { target_type: "profiles", action: "update" },
      ]),
    );
    const clientDb = await signedInClient(await createUser(admin, "tbl-audit-client"));
    const { data: hidden } = await clientDb.from("audit_log").select("id");
    expect(hidden).toEqual([]);
    const write = await clientDb.from("audit_log").insert({ action: "x", target_type: "y" });
    expect(write.error?.code).toBe("42501");
  });

  it("does not log an update that changed nothing but updated_at", async () => {
    const id = await createWorkout(admin, workout("Без промяна"));
    await boss.from("workouts").update({ title: "Без промяна" }).eq("id", id);
    const { data } = await admin.from("audit_log").select("id").eq("target_id", id).eq("action", "update");
    expect(data).toEqual([]);
  });
});

describe("settings", () => {
  it("lets an admin upsert and read a setting, hidden from clients", async () => {
    const value = { inactiveDays: 6, minCompletionPct: 40 };
    const { error } = await boss.from("settings").upsert({ key: "risk", value });
    expect(error).toBeNull();
    const { data } = await boss.from("settings").select("value").eq("key", "risk").single();
    expect(data?.value).toEqual(value);
    const clientDb = await signedInClient(await createUser(admin, "tbl-set-client"));
    const { data: hidden } = await clientDb.from("settings").select("key");
    expect(hidden).toEqual([]);
    await boss.from("settings").delete().eq("key", "risk");
  });
});

describe("thumbnails bucket", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("lets an admin upload and anyone read by public URL; clients cannot upload", async () => {
    const path = `test-${crypto.randomUUID()}.png`;
    const up = await boss.storage.from("thumbnails").upload(path, png, { contentType: "image/png" });
    expect(up.error).toBeNull();
    const { data } = boss.storage.from("thumbnails").getPublicUrl(path);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);
    const clientDb = await signedInClient(await createUser(admin, "tbl-thumb"));
    const denied = await clientDb.storage.from("thumbnails").upload(`x-${crypto.randomUUID()}.png`, png, { contentType: "image/png" });
    expect(denied.error).not.toBeNull();
    await boss.storage.from("thumbnails").remove([path]);
  });
});
```

Run: `pnpm test:db supabase/tests/admin-tables.test.ts`
Expected: FAIL — tables/function/bucket do not exist.

- [ ] **Step 2: Write the migration**

`supabase/migrations/20261015100100_admin_tables.sql`:

```sql
create type public.note_kind as enum ('call', 'message', 'note', 'snooze');

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind public.note_kind not null,
  body text not null default '' check (char_length(body) <= 2000),
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  constraint client_notes_snooze check ((kind = 'snooze') = (snooze_until is not null))
);
create index client_notes_user_created on public.client_notes (user_id, created_at desc);

-- No foreign keys: the log must outlive the rows and people it mentions.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created on public.audit_log (created_at desc);
create index audit_log_target on public.audit_log (target_id);

create table public.settings (
  key text primary key check (key ~ '^[a-z_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- Row-level audit. tg_argv[0] names the column that identifies the row.
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k))
      into v_diff
      from jsonb_object_keys(v_new) as k
      where k <> 'updated_at' and (v_new -> k) is distinct from (v_old -> k);
    if v_diff is null then
      return new;
    end if;
  else
    v_diff := coalesce(v_new, v_old);
  end if;
  insert into public.audit_log (actor_id, action, target_type, target_id, diff)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_new, v_old) ->> tg_argv[0],
    v_diff
  );
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;

create trigger workouts_audit after insert or update or delete on public.workouts
  for each row execute function public.audit_row('id');
create trigger workout_media_audit after insert or update or delete on public.workout_media
  for each row execute function public.audit_row('workout_id');
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function public.audit_row('id');
create trigger subscriptions_audit after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row('user_id');
create trigger settings_audit after insert or update or delete on public.settings
  for each row execute function public.audit_row('key');
create trigger profiles_role_audit after update of role on public.profiles
  for each row execute function public.audit_row('id');

-- Starter week order in one transaction (the partial unique index forbids pairwise swaps).
create function public.admin_reorder_starters(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i int;
  n int := coalesce(array_length(p_ids, 1), 0);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if n <> (select count(*) from public.workouts where kind = 'starter')
     or n <> (select count(distinct x) from unnest(p_ids) as x)
     or exists (
       select 1 from unnest(p_ids) as x
       where not exists (select 1 from public.workouts w where w.id = x and w.kind = 'starter')
     )
  then
    raise exception 'reorder must list every starter workout exactly once' using errcode = '22023';
  end if;
  update public.workouts set starter_order = -starter_order where kind = 'starter';
  for i in 1 .. n loop
    update public.workouts set starter_order = i where id = p_ids[i];
  end loop;
end $$;
revoke execute on function public.admin_reorder_starters(uuid[]) from public, anon;
grant execute on function public.admin_reorder_starters(uuid[]) to authenticated;

-- RLS
alter table public.client_notes enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings enable row level security;

create policy client_notes_admin_select on public.client_notes for select to authenticated
  using ((select public.is_admin()));
create policy client_notes_admin_insert on public.client_notes for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

create policy audit_log_admin_select on public.audit_log for select to authenticated
  using ((select public.is_admin()));

create policy settings_admin_select on public.settings for select to authenticated
  using ((select public.is_admin()));
create policy settings_admin_insert on public.settings for insert to authenticated
  with check ((select public.is_admin()));
create policy settings_admin_update on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_admin_delete on public.settings for delete to authenticated
  using ((select public.is_admin()));

create policy workouts_admin_insert on public.workouts for insert to authenticated
  with check ((select public.is_admin()));
create policy workouts_admin_update on public.workouts for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Never erase history: only workouts nobody has completed can be deleted.
create policy workouts_admin_delete on public.workouts for delete to authenticated
  using (
    (select public.is_admin())
    and not exists (select 1 from public.workout_completions c where c.workout_id = workouts.id)
  );

create policy workout_media_admin_insert on public.workout_media for insert to authenticated
  with check ((select public.is_admin()));
create policy workout_media_admin_update on public.workout_media for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy workout_media_admin_delete on public.workout_media for delete to authenticated
  using ((select public.is_admin()));

create policy plans_admin_insert on public.plans for insert to authenticated
  with check ((select public.is_admin()));
create policy plans_admin_update on public.plans for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Admins may only manage manual (comp) grants; paid subscriptions belong to the payment provider.
create policy subscriptions_admin_insert on public.subscriptions for insert to authenticated
  with check ((select public.is_admin()) and provider = 'manual');
create policy subscriptions_admin_update on public.subscriptions for update to authenticated
  using ((select public.is_admin()) and provider = 'manual')
  with check ((select public.is_admin()) and provider = 'manual');

-- Grants (RLS above decides which rows; non-admins match no write policy).
revoke all on public.client_notes, public.audit_log, public.settings from anon;
revoke insert, update, delete on public.client_notes, public.audit_log, public.settings from authenticated;
grant select, insert on public.client_notes to authenticated;
grant select on public.audit_log to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant insert, update, delete on public.workouts, public.workout_media to authenticated;
grant insert, update on public.plans, public.subscriptions to authenticated;

-- Thumbnails: public read by URL, admin-only writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnails', 'thumbnails', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy thumbnails_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'thumbnails' and (select public.is_admin()));
create policy thumbnails_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'thumbnails' and (select public.is_admin()));
create policy thumbnails_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'thumbnails' and (select public.is_admin()));
```

Then add `"audit_log"`, `"client_notes"`, `"settings"` to `TABLES` in `supabase/tests/privileges.test.ts`.

Run: `pnpm db:reset && pnpm db:types`
Expected: reset succeeds.

- [ ] **Step 3: Run the tests**

Run: `pnpm test:db supabase/tests/admin-tables.test.ts && pnpm test:db`
Expected: PASS (all DB files, including privileges with the new tables). If the storage upload test fails because the bucket MIME check rejects the 12-byte stub, use a real 1×1 PNG byte array.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): admin write policies, client notes, settings, audit log, thumbnails bucket

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Report functions — client stats and dashboard

**Files:**
- Create: `supabase/migrations/20261015100200_admin_reports.sql`, `supabase/tests/admin-reports.test.ts`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: `is_admin()`, `has_active_access()`, `subscriptions.canceled_at`, `client_notes`.
- Produces (SQL):
  - `admin_client_stats(p_search text default null, p_limit int default 200, p_offset int default 0) returns table(user_id uuid, name text, email text, phone text, phone_call_consent boolean, level workout_level, joined_at timestamptz, last_seen_at timestamptz, onboarding_done boolean, sub_status subscription_status, sub_provider payment_provider, current_period_end timestamptz, has_access boolean, total_done int, last_done_at timestamptz, done_7 int, done_30 int, minutes_7 int, minutes_30 int, published_14 int, done_regular_14 int, paid_without_workout boolean, snoozed_until timestamptz, total_count bigint)` — clients only (role `client`), newest first, `p_limit` capped at 1000.
  - `admin_dashboard(p_now timestamptz default now()) returns jsonb` with keys `visits{today,d7,d30,unique_d30}`, `sources[{source,visits}]`, `funnel{visitors,signups,free_done,paid}`, `registrations{d7,d30}`, `subscriptions{active,mrr_cents,canceled_30}`, `top_workouts[{id,title,completions}]`. Windowed numbers are relative to `p_now`; `active` and `mrr_cents` are "right now".
  - Both raise `42501` for non-admins (including aal1 admins).

- [ ] **Step 1: Write the failing tests**

`supabase/tests/admin-reports.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  createWorkout,
  freeWorkoutId,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "rep-admin")).db;
});

async function statsFor(email: string) {
  const { data, error } = await boss.rpc("admin_client_stats", { p_search: email });
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  return data![0]!;
}

describe("admin_client_stats", () => {
  it("is refused to aal1 admins and clients", async () => {
    const half = await createAal1Admin(admin, "rep-half");
    const { error } = await half.db.rpc("admin_client_stats", {});
    expect(error?.code).toBe("42501");
  });

  it("counts recent workouts, minutes and the 14-day completion rate", async () => {
    const user = await createUser(admin, "rep-count", { name: "Мила" });
    await admin.from("profiles").update({ level: "pro", joined_at: ago(40) }).eq("id", user.id);
    const w1 = await createWorkout(admin, { title: "R1", kind: "regular", level: "pro", duration_min: 30, publish_at: ago(10) });
    const w2 = await createWorkout(admin, { title: "R2", kind: "regular", level: "pro", duration_min: 40, publish_at: ago(3) });
    const free = await freeWorkoutId(admin);
    for (const [workout_id, at] of [[w1, ago(9)], [w2, ago(2)], [free, ago(20)]] as const) {
      const { error } = await admin.from("workout_completions").insert({ user_id: user.id, workout_id, completed_at: at });
      expect(error).toBeNull();
    }
    const row = await statsFor(user.email);
    expect(row).toMatchObject({ name: "Мила", total_done: 3, done_7: 1, done_30: 3, minutes_7: 40, done_regular_14: 2 });
    expect(row.published_14).toBeGreaterThanOrEqual(2);
    expect(row.has_access).toBe(false);
  });

  it("flags a paying client with no workout yet, and reports a snooze", async () => {
    const user = await createUser(admin, "rep-paid");
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "active" });
    const until = new Date(Date.now() + 3 * day).toISOString();
    await boss.from("client_notes").insert({ user_id: user.id, kind: "snooze", snooze_until: until });
    const row = await statsFor(user.email);
    expect(row.paid_without_workout).toBe(true);
    expect(row.has_access).toBe(true);
    expect(Date.parse(row.snoozed_until!)).toBe(Date.parse(until));
  });

  it("lists clients only and reports the total", async () => {
    const { data, error } = await boss.rpc("admin_client_stats", { p_limit: 5 });
    expect(error).toBeNull();
    expect(data!.length).toBeLessThanOrEqual(5);
    expect(Number(data![0]!.total_count)).toBeGreaterThanOrEqual(data!.length);
    const { data: admins } = await admin.from("profiles").select("email").eq("role", "admin").limit(1);
    const { data: found } = await boss.rpc("admin_client_stats", { p_search: admins![0]!.email });
    expect(found).toEqual([]);
  });
});

describe("admin_dashboard", () => {
  // A window far in the future, filled only by this test, so other tests' rows do not count.
  const now = "2031-03-10T12:00:00Z";
  const at = (daysBefore: number) => new Date(Date.parse(now) - daysBefore * day).toISOString();

  it("is refused to non-admins", async () => {
    const half = await createAal1Admin(admin, "rep-dash-half");
    const { error } = await half.db.rpc("admin_dashboard", { p_now: now });
    expect(error?.code).toBe("42501");
  });

  it("counts visits, sources, sign-ups, the funnel and top workouts in the window", async () => {
    const anonA = crypto.randomUUID();
    const anonB = crypto.randomUUID();
    const rows = [
      { anon_id: anonA, path: "/", device: "mobile", created_at: at(0.1), utm: { utm_source: "meta" } },
      { anon_id: anonA, path: "/start", device: "mobile", created_at: at(0.05), utm: null },
      { anon_id: anonB, path: "/", device: "desktop", created_at: at(5), referrer: "https://www.google.com/search?q=x", utm: null },
      { anon_id: anonB, path: "/", device: "desktop", created_at: at(40), utm: null },
    ];
    expect((await admin.from("visits").insert(rows)).error).toBeNull();

    const signup = await createUser(admin, "rep-funnel");
    await admin.from("profiles").update({ joined_at: at(2) }).eq("id", signup.id);
    const free = await freeWorkoutId(admin);
    await admin.from("workout_completions").insert({ user_id: signup.id, workout_id: free, completed_at: at(2) });
    await admin.from("subscriptions").insert({ user_id: signup.id, provider: "stripe", status: "active" });

    const { data, error } = await boss.rpc("admin_dashboard", { p_now: now });
    expect(error).toBeNull();
    const d = data as Record<string, any>;
    expect(d.visits).toMatchObject({ d7: 3, d30: 3, unique_d30: 2 });
    expect(d.visits.today).toBeGreaterThanOrEqual(1);
    expect(d.sources).toEqual(expect.arrayContaining([{ source: "meta", visits: 1 }, { source: "www.google.com", visits: 1 }]));
    expect(d.funnel).toMatchObject({ visitors: 2, signups: 1, free_done: 1, paid: 1 });
    expect(d.registrations).toMatchObject({ d7: 1, d30: 1 });
    expect(d.top_workouts[0]).toMatchObject({ id: free, completions: 1 });
  });

  it("reports active subscriptions and MRR right now, ignoring manual grants", async () => {
    const before = ((await boss.rpc("admin_dashboard", {})).data as any).subscriptions;
    const { data: plan } = await admin.from("plans").select("id, price_cents").eq("interval", "year").single();
    const paid = await createUser(admin, "rep-mrr");
    await admin.from("subscriptions").insert({ user_id: paid.id, provider: "stripe", status: "active", plan_id: plan!.id });
    const comp = await createUser(admin, "rep-comp");
    await admin.from("subscriptions").insert({ user_id: comp.id, provider: "manual", status: "active", plan_id: plan!.id });
    const after = ((await boss.rpc("admin_dashboard", {})).data as any).subscriptions;
    expect(after.active - before.active).toBe(1);
    expect(after.mrr_cents - before.mrr_cents).toBe(Math.round(plan!.price_cents / 12));
  });
});
```

Run: `pnpm test:db supabase/tests/admin-reports.test.ts`
Expected: FAIL — functions do not exist.

- [ ] **Step 2: Write the migration**

`supabase/migrations/20261015100200_admin_reports.sql`:

```sql
-- One row per client with the numbers the Clients, Activity and At-risk screens need.
create function public.admin_client_stats(
  p_search text default null,
  p_limit int default 200,
  p_offset int default 0
) returns table (
  user_id uuid, name text, email text, phone text, phone_call_consent boolean,
  level public.workout_level, joined_at timestamptz, last_seen_at timestamptz, onboarding_done boolean,
  sub_status public.subscription_status, sub_provider public.payment_provider,
  current_period_end timestamptz, has_access boolean,
  total_done int, last_done_at timestamptz, done_7 int, done_30 int, minutes_7 int, minutes_30 int,
  published_14 int, done_regular_14 int, paid_without_workout boolean, snoozed_until timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select
    b.id, b.name, b.email, b.phone, b.phone_call_consent, b.level, b.joined_at, b.last_seen_at,
    b.onboarding_done, s.status, s.provider, s.current_period_end,
    public.has_active_access(b.id),
    c.total_done, c.last_done_at, c.done_7, c.done_30, c.minutes_7, c.minutes_30,
    r.published_14, r.done_regular_14,
    coalesce(s.provider in ('stripe', 'revolut'), false)
      and public.has_active_access(b.id) and c.done_paid = 0,
    n.snoozed_until,
    count(*) over ()
  from public.profiles b
  left join public.subscriptions s on s.user_id = b.id
  left join lateral (
    select
      count(*)::int as total_done,
      max(cc.completed_at) as last_done_at,
      (count(*) filter (where cc.completed_at > now() - interval '7 days'))::int as done_7,
      (count(*) filter (where cc.completed_at > now() - interval '30 days'))::int as done_30,
      coalesce(sum(w.duration_min) filter (where cc.completed_at > now() - interval '7 days'), 0)::int as minutes_7,
      coalesce(sum(w.duration_min) filter (where cc.completed_at > now() - interval '30 days'), 0)::int as minutes_30,
      (count(*) filter (where w.kind <> 'free'))::int as done_paid
    from public.workout_completions cc
    join public.workouts w on w.id = cc.workout_id
    where cc.user_id = b.id
  ) c on true
  left join lateral (
    select
      count(*)::int as published_14,
      (count(*) filter (
        where exists (
          select 1 from public.workout_completions x where x.user_id = b.id and x.workout_id = w2.id
        )
      ))::int as done_regular_14
    from public.workouts w2
    where w2.kind = 'regular' and w2.level = b.level
      and w2.publish_at > now() - interval '14 days' and w2.publish_at <= now()
      and w2.publish_at >= coalesce(b.starter_week_done_at, b.joined_at)
  ) r on true
  left join lateral (
    select max(cn.snooze_until) as snoozed_until
    from public.client_notes cn
    where cn.user_id = b.id and cn.kind = 'snooze'
  ) n on true
  where b.role = 'client'
    and (
      p_search is null or p_search = ''
      or b.name ilike '%' || p_search || '%'
      or b.email ilike '%' || p_search || '%'
    )
  order by b.joined_at desc
  limit greatest(least(p_limit, 1000), 1)
  offset greatest(p_offset, 0);
end $$;
revoke execute on function public.admin_client_stats(text, int, int) from public, anon;
grant execute on function public.admin_client_stats(text, int, int) to authenticated;

-- Dashboard numbers. Windows end at p_now; "right now" numbers (active, MRR) use the real clock.
create function public.admin_dashboard(p_now timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day_start timestamptz := ((p_now at time zone 'Europe/Sofia')::date)::timestamp at time zone 'Europe/Sofia';
  v_7 timestamptz := p_now - interval '7 days';
  v_30 timestamptz := p_now - interval '30 days';
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'visits', jsonb_build_object(
      'today', (select count(*) from public.visits v where v.created_at >= v_day_start and v.created_at <= p_now),
      'd7', (select count(*) from public.visits v where v.created_at > v_7 and v.created_at <= p_now),
      'd30', (select count(*) from public.visits v where v.created_at > v_30 and v.created_at <= p_now),
      'unique_d30', (select count(distinct v.anon_id) from public.visits v where v.created_at > v_30 and v.created_at <= p_now)
    ),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', t.src, 'visits', t.n) order by t.n desc, t.src)
      from (
        select
          coalesce(
            nullif(v.utm ->> 'utm_source', ''),
            nullif(split_part(split_part(v.referrer, '://', 2), '/', 1), ''),
            'direct'
          ) as src,
          count(*) as n
        from public.visits v
        where v.created_at > v_30 and v.created_at <= p_now
        group by 1
        order by 2 desc
        limit 10
      ) t
    ), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'visitors', (select count(distinct v.anon_id) from public.visits v where v.created_at > v_30 and v.created_at <= p_now),
      'signups', (select count(*) from public.profiles p where p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now),
      'free_done', (
        select count(distinct c.user_id)
        from public.workout_completions c
        join public.workouts w on w.id = c.workout_id
        join public.profiles p on p.id = c.user_id
        where w.kind = 'free' and p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now
      ),
      'paid', (
        select count(*)
        from public.subscriptions s
        join public.profiles p on p.id = s.user_id
        where s.provider <> 'manual' and p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now
      )
    ),
    'registrations', jsonb_build_object(
      'd7', (select count(*) from public.profiles p where p.role = 'client' and p.joined_at > v_7 and p.joined_at <= p_now),
      'd30', (select count(*) from public.profiles p where p.role = 'client' and p.joined_at > v_30 and p.joined_at <= p_now)
    ),
    'subscriptions', jsonb_build_object(
      'active', (select count(*) from public.subscriptions s where s.provider <> 'manual' and public.has_active_access(s.user_id)),
      'mrr_cents', (
        select coalesce(sum(case pl.interval when 'year' then round(pl.price_cents / 12.0) else pl.price_cents end), 0)::bigint
        from public.subscriptions s
        join public.plans pl on pl.id = s.plan_id
        where s.provider <> 'manual' and s.status in ('active', 'trialing')
      ),
      'canceled_30', (select count(*) from public.subscriptions s where s.provider <> 'manual' and s.canceled_at > v_30 and s.canceled_at <= p_now)
    ),
    'top_workouts', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'completions', t.n) order by t.n desc, t.title)
      from (
        select w.id, w.title, count(*) as n
        from public.workout_completions c
        join public.workouts w on w.id = c.workout_id
        where c.completed_at > v_30 and c.completed_at <= p_now
        group by w.id, w.title
        order by n desc
        limit 5
      ) t
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke execute on function public.admin_dashboard(timestamptz) from public, anon;
grant execute on function public.admin_dashboard(timestamptz) to authenticated;
```

Run: `pnpm db:reset && pnpm db:types`

- [ ] **Step 3: Run the tests**

Run: `pnpm test:db supabase/tests/admin-reports.test.ts && pnpm test:db`
Expected: PASS. (If `d.visits.today` is 0 because `at(0.1)` falls before Sofia midnight of 2031-03-10, the assertion `>= 1` still holds via `at(0.05)` — both are 2031-03-10 ~10:48/11:24 UTC = 12:48/13:24 Sofia.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): admin client stats and dashboard report functions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Admin domain logic (time zones, scheduling, calendar, risk, settings, video input, form data)

**Files:**
- Create: `src/lib/admin/time.ts`, `src/lib/admin/time.test.ts`, `src/lib/admin/schedule.ts`, `src/lib/admin/schedule.test.ts`, `src/lib/admin/calendar.ts`, `src/lib/admin/calendar.test.ts`, `src/lib/admin/risk.ts`, `src/lib/admin/risk.test.ts`, `src/lib/admin/settings.ts`, `src/lib/admin/settings.test.ts`, `src/lib/form-data.ts`, `src/lib/form-data.test.ts`
- Modify: `src/lib/video/parse-video-url.ts`, `src/lib/video/parse-video-url.test.ts`

**Interfaces:**
- Produces:
  - `ADMIN_TZ = "Europe/Sofia"`; `zonedToUtc(date: string, time: string, timeZone?: string): string` (ISO UTC); `utcToZoned(iso: string, timeZone?: string): { date: string; time: string }`
  - `distributeDates(input: { startDate: string; weekdays: number[]; time: string; count: number; timeZone?: string }): string[]` — weekdays 0 = Monday … 6 = Sunday; ISO UTC strings
  - `type WorkoutStatus = "draft" | "scheduled" | "published"`; `workoutStatus(publishAt: string | null, now: Date): WorkoutStatus`; `monthGrid(year: number, month: number): string[][]` (weeks Monday-first, `YYYY-MM-DD`); `weekOf(date: string): string[]`; `levelGaps(items: { kind: string; level: Level | null; publishAt: string | null }[], now: Date, horizonDays?: number): { level: Level; lastAt: string | null }[]`
  - `type RiskReason = "inactive" | "low_completion" | "no_first_workout" | "past_due"`; `RISK_LABEL: Record<RiskReason, string>`; `interface RiskThresholds { inactiveDays: number; minCompletionPct: number }`; `assessRisk(c: RiskInput, t: RiskThresholds, now: Date): RiskReason[]` with `RiskInput = { hasAccess: boolean; subStatus: string | null; joinedAt: string; lastDoneAt: string | null; published14: number; doneRegular14: number; paidWithoutWorkout: boolean; snoozedUntil: string | null }`; `completionPct(done: number, published: number): number | null`
  - `SETTINGS` (zod schemas for keys `risk`, `payment_provider`, `tracking`, `email_templates`), `type SettingKey`, `type SettingValue<K>`, `SETTING_DEFAULTS`, `parseSetting(key, raw)`, `renderTemplate(tpl: string, vars: Record<string, string>): string`
  - `normalizeVideoInput(raw: string): string` (adds `https://` to scheme-less links); `parseVideoUrl` accepts scheme-less input
  - `formString(form: FormData, key: string): string`, `formInt(form, key): number`, `formBool(form, key): boolean`, `formList(form, key): string[]`

- [ ] **Step 1: Write the failing tests**

`src/lib/admin/time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { utcToZoned, zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("converts Sofia summer and winter time", () => {
    expect(zonedToUtc("2026-10-20", "07:00")).toBe("2026-10-20T04:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "07:00")).toBe("2026-12-01T05:00:00.000Z");
  });

  it("handles both DST switches", () => {
    expect(zonedToUtc("2026-10-25", "07:00")).toBe("2026-10-25T05:00:00.000Z");
    expect(zonedToUtc("2026-10-26", "07:00")).toBe("2026-10-26T05:00:00.000Z");
    expect(zonedToUtc("2026-03-29", "07:00")).toBe("2026-03-29T04:00:00.000Z");
  });

  it("supports other zones", () => {
    expect(zonedToUtc("2026-10-20", "07:00", "UTC")).toBe("2026-10-20T07:00:00.000Z");
  });
});

describe("utcToZoned", () => {
  it("is the inverse in Sofia", () => {
    expect(utcToZoned("2026-10-26T05:00:00.000Z")).toEqual({ date: "2026-10-26", time: "07:00" });
    expect(utcToZoned("2026-10-20T21:30:00.000Z")).toEqual({ date: "2026-10-21", time: "00:30" });
  });
});
```

`src/lib/admin/schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { distributeDates } from "./schedule";

describe("distributeDates", () => {
  it("places items on the chosen weekdays from the start date on", () => {
    // 2026-10-19 is a Monday. Tue=1, Thu=3, Sat=5.
    expect(
      distributeDates({ startDate: "2026-10-19", weekdays: [1, 3, 5], time: "07:00", count: 5 }),
    ).toEqual([
      "2026-10-20T04:00:00.000Z",
      "2026-10-22T04:00:00.000Z",
      "2026-10-24T04:00:00.000Z",
      "2026-10-27T05:00:00.000Z",
      "2026-10-29T05:00:00.000Z",
    ]);
  });

  it("includes the start date when it matches", () => {
    expect(distributeDates({ startDate: "2026-10-20", weekdays: [1], time: "18:30", count: 1 })).toEqual([
      "2026-10-20T15:30:00.000Z",
    ]);
  });

  it("returns nothing without weekdays or count", () => {
    expect(distributeDates({ startDate: "2026-10-20", weekdays: [], time: "07:00", count: 3 })).toEqual([]);
    expect(distributeDates({ startDate: "2026-10-20", weekdays: [1], time: "07:00", count: 0 })).toEqual([]);
  });
});
```

`src/lib/admin/calendar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { levelGaps, monthGrid, weekOf, workoutStatus } from "./calendar";

describe("workoutStatus", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  it("classifies draft, scheduled and published", () => {
    expect(workoutStatus(null, now)).toBe("draft");
    expect(workoutStatus("2026-10-21T04:00:00Z", now)).toBe("scheduled");
    expect(workoutStatus("2026-10-20T10:00:00Z", now)).toBe("published");
  });
});

describe("monthGrid", () => {
  it("covers October 2026 in Monday-first weeks", () => {
    const grid = monthGrid(2026, 10);
    expect(grid[0]?.[0]).toBe("2026-09-28");
    expect(grid.at(-1)?.at(-1)).toBe("2026-11-01");
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat()).toContain("2026-10-31");
  });
});

describe("weekOf", () => {
  it("returns Monday..Sunday around a date", () => {
    expect(weekOf("2026-10-22")).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
  });
});

describe("levelGaps", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  it("flags levels without regular content beyond the horizon", () => {
    const gaps = levelGaps(
      [
        { kind: "regular", level: "beginner", publishAt: "2026-10-30T04:00:00Z" },
        { kind: "regular", level: "advanced", publishAt: "2026-10-22T04:00:00Z" },
        { kind: "starter", level: null, publishAt: "2026-12-01T04:00:00Z" },
        { kind: "regular", level: "pro", publishAt: null },
      ],
      now,
      7,
    );
    expect(gaps).toEqual([
      { level: "advanced", lastAt: "2026-10-22T04:00:00Z" },
      { level: "pro", lastAt: null },
    ]);
  });
});
```

`src/lib/admin/risk.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assessRisk, completionPct, type RiskInput } from "./risk";

const now = new Date("2026-10-20T10:00:00Z");
const t = { inactiveDays: 5, minCompletionPct: 50 };
const base: RiskInput = {
  hasAccess: true,
  subStatus: "active",
  joinedAt: "2026-09-01T00:00:00Z",
  lastDoneAt: "2026-10-19T08:00:00Z",
  published14: 6,
  doneRegular14: 5,
  paidWithoutWorkout: false,
  snoozedUntil: null,
};

describe("assessRisk", () => {
  it("is quiet for an active, regular client", () => {
    expect(assessRisk(base, t, now)).toEqual([]);
  });

  it("flags inactivity from the last workout, or from joining if none", () => {
    expect(assessRisk({ ...base, lastDoneAt: "2026-10-14T10:00:00Z" }, t, now)).toEqual(["inactive"]);
    expect(assessRisk({ ...base, lastDoneAt: null, joinedAt: "2026-10-01T00:00:00Z" }, t, now)).toContain("inactive");
  });

  it("flags a low completion rate only with enough published workouts", () => {
    expect(assessRisk({ ...base, doneRegular14: 2 }, t, now)).toEqual(["low_completion"]);
    expect(assessRisk({ ...base, published14: 1, doneRegular14: 0 }, t, now)).toEqual([]);
  });

  it("flags a paid client without a first workout and a failed payment", () => {
    expect(assessRisk({ ...base, paidWithoutWorkout: true }, t, now)).toContain("no_first_workout");
    expect(assessRisk({ ...base, subStatus: "past_due" }, t, now)).toContain("past_due");
  });

  it("ignores leads without access, except a failed payment", () => {
    const lead = { ...base, hasAccess: false, subStatus: null, lastDoneAt: null, doneRegular14: 0 };
    expect(assessRisk(lead, t, now)).toEqual([]);
    expect(assessRisk({ ...lead, subStatus: "past_due" }, t, now)).toEqual(["past_due"]);
  });

  it("stays quiet while snoozed", () => {
    expect(assessRisk({ ...base, lastDoneAt: null, snoozedUntil: "2026-10-25T00:00:00Z" }, t, now)).toEqual([]);
  });
});

describe("completionPct", () => {
  it("rounds and handles zero", () => {
    expect(completionPct(5, 9)).toBe(56);
    expect(completionPct(0, 0)).toBeNull();
  });
});
```

`src/lib/admin/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseSetting, renderTemplate, SETTING_DEFAULTS, SETTINGS } from "./settings";

describe("settings", () => {
  it("falls back to defaults for missing or invalid values", () => {
    expect(parseSetting("risk", undefined)).toEqual(SETTING_DEFAULTS.risk);
    expect(parseSetting("risk", { inactiveDays: -1, minCompletionPct: 50 })).toEqual(SETTING_DEFAULTS.risk);
    expect(parseSetting("risk", { inactiveDays: 7, minCompletionPct: 40 })).toEqual({ inactiveDays: 7, minCompletionPct: 40 });
  });

  it("validates tracking ids", () => {
    expect(SETTINGS.tracking.safeParse({ metaPixelId: "1234567890", ga4Id: "G-ABC1234", gtmId: "GTM-AB12CD", googleAdsId: "AW-123456789" }).success).toBe(true);
    expect(SETTINGS.tracking.safeParse({ metaPixelId: "abc", ga4Id: "", gtmId: "", googleAdsId: "" }).success).toBe(false);
  });

  it("renders template placeholders and leaves unknown ones visible", () => {
    expect(renderTemplate("Здравей, {{name}}! {{x}}", { name: "Ани" })).toBe("Здравей, Ани! {{x}}");
  });
});
```

`src/lib/form-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formBool, formInt, formList, formString } from "./form-data";

describe("form-data helpers", () => {
  const form = new FormData();
  form.set("name", "  Ани  ");
  form.set("days", "14");
  form.set("notify", "on");
  form.append("focus", "core");
  form.append("focus", "upper");

  it("reads and trims values", () => {
    expect(formString(form, "name")).toBe("Ани");
    expect(formString(form, "missing")).toBe("");
    expect(formInt(form, "days")).toBe(14);
    expect(Number.isNaN(formInt(form, "name"))).toBe(true);
    expect(formBool(form, "notify")).toBe(true);
    expect(formBool(form, "missing")).toBe(false);
    expect(formList(form, "focus")).toEqual(["core", "upper"]);
  });
});
```

Append to `src/lib/video/parse-video-url.test.ts`:

```ts
import { normalizeVideoInput } from "./parse-video-url";

describe("scheme-less and hostile input", () => {
  it("accepts links pasted without https://", () => {
    expect(parseVideoUrl("youtu.be/ml6cT4AZdqI")?.id).toBe("ml6cT4AZdqI");
    expect(parseVideoUrl("www.youtube.com/watch?v=ml6cT4AZdqI")?.id).toBe("ml6cT4AZdqI");
    expect(normalizeVideoInput(" youtu.be/ml6cT4AZdqI ")).toBe("https://youtu.be/ml6cT4AZdqI");
    expect(normalizeVideoInput("https://youtu.be/ml6cT4AZdqI")).toBe("https://youtu.be/ml6cT4AZdqI");
  });

  it.each([
    "https://youtube.com.evil.com/watch?v=ml6cT4AZdqI",
    "https://evilyoutube.com/watch?v=ml6cT4AZdqI",
    "https://youtube.com@evil.com/watch?v=ml6cT4AZdqI",
    "ftp://youtu.be/ml6cT4AZdqI",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });

  it("accepts an uppercase host", () => {
    expect(parseVideoUrl("https://YOUTU.BE/ml6cT4AZdqI")?.id).toBe("ml6cT4AZdqI");
  });
});
```

Run: `pnpm test src/lib/admin src/lib/form-data.test.ts src/lib/video`
Expected: FAIL — modules missing; scheme-less cases return null.

- [ ] **Step 2: Implement**

`src/lib/admin/time.ts`:

```ts
export const ADMIN_TZ = "Europe/Sofia";

/** Wall-clock minus UTC (ms) for `timeZone` at instant `at`. */
function offsetMs(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at / 1000) * 1000;
}

/** UTC instant (ISO) of a wall-clock date + time in a zone, e.g. ("2026-10-26", "07:00"). */
export function zonedToUtc(date: string, time: string, timeZone: string = ADMIN_TZ): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  let ts = wall - offsetMs(wall, timeZone);
  ts = wall - offsetMs(ts, timeZone); // second pass settles DST transitions
  return new Date(ts).toISOString();
}

export function utcToZoned(iso: string, timeZone: string = ADMIN_TZ): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayOf(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}
```

`src/lib/admin/schedule.ts`:

```ts
import { ADMIN_TZ, addDays, weekdayOf, zonedToUtc } from "./time";

/** Publish times for `count` workouts on the chosen weekdays (0 = Monday), from startDate on. */
export function distributeDates(input: {
  startDate: string;
  weekdays: number[];
  time: string;
  count: number;
  timeZone?: string;
}): string[] {
  const days = new Set(input.weekdays.filter((d) => d >= 0 && d <= 6));
  if (days.size === 0 || input.count <= 0) return [];
  const out: string[] = [];
  for (let date = input.startDate; out.length < input.count; date = addDays(date, 1)) {
    if (days.has(weekdayOf(date))) out.push(zonedToUtc(date, input.time, input.timeZone ?? ADMIN_TZ));
  }
  return out;
}
```

`src/lib/admin/calendar.ts`:

```ts
import type { Level } from "@/lib/program/types";
import { addDays, weekdayOf } from "./time";

export type WorkoutStatus = "draft" | "scheduled" | "published";

export function workoutStatus(publishAt: string | null, now: Date): WorkoutStatus {
  if (publishAt === null) return "draft";
  return Date.parse(publishAt) > now.getTime() ? "scheduled" : "published";
}

export function weekOf(date: string): string[] {
  const monday = addDays(date, -weekdayOf(date));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Monday-first weeks covering the whole month (month is 1-12). */
export function monthGrid(year: number, month: number): string[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const weeks: string[][] = [];
  for (let start = weekOf(first)[0]!; start <= last; start = addDays(start, 7)) {
    weeks.push(weekOf(start));
  }
  return weeks;
}

const LEVELS: Level[] = ["beginner", "advanced", "pro"];

/** Levels whose newest regular workout goes live before now + horizonDays (or that have none). */
export function levelGaps(
  items: { kind: string; level: Level | null; publishAt: string | null }[],
  now: Date,
  horizonDays = 7,
): { level: Level; lastAt: string | null }[] {
  const horizon = now.getTime() + horizonDays * 86_400_000;
  return LEVELS.flatMap((level) => {
    const times = items
      .filter((i) => i.kind === "regular" && i.level === level && i.publishAt)
      .map((i) => i.publishAt!);
    const lastAt = times.sort().at(-1) ?? null;
    return lastAt === null || Date.parse(lastAt) < horizon ? [{ level, lastAt }] : [];
  });
}
```

`src/lib/admin/risk.ts`:

```ts
export type RiskReason = "inactive" | "low_completion" | "no_first_workout" | "past_due";

export const RISK_LABEL: Record<RiskReason, string> = {
  inactive: "Не тренира",
  low_completion: "Под нормата",
  no_first_workout: "Платила, без тренировка",
  past_due: "Неуспешно плащане",
};

export interface RiskThresholds {
  inactiveDays: number;
  minCompletionPct: number;
}

export interface RiskInput {
  hasAccess: boolean;
  subStatus: string | null;
  joinedAt: string;
  lastDoneAt: string | null;
  published14: number;
  doneRegular14: number;
  paidWithoutWorkout: boolean;
  snoozedUntil: string | null;
}

export function completionPct(done: number, published: number): number | null {
  return published > 0 ? Math.round((done / published) * 100) : null;
}

/** Why a client needs a nudge (spec §6 "Изостават"). Leads without access only count for failed payments. */
export function assessRisk(c: RiskInput, t: RiskThresholds, now: Date): RiskReason[] {
  if (c.snoozedUntil && Date.parse(c.snoozedUntil) > now.getTime()) return [];
  const reasons: RiskReason[] = [];
  if (c.hasAccess) {
    const since = Date.parse(c.lastDoneAt ?? c.joinedAt);
    if (now.getTime() - since >= t.inactiveDays * 86_400_000) reasons.push("inactive");
    const pct = completionPct(c.doneRegular14, c.published14);
    if (c.published14 >= 2 && pct !== null && pct < t.minCompletionPct) reasons.push("low_completion");
    if (c.paidWithoutWorkout) reasons.push("no_first_workout");
  }
  if (c.subStatus === "past_due") reasons.push("past_due");
  return reasons;
}
```

`src/lib/admin/settings.ts`:

```ts
import { z } from "zod";

const optionalId = (re: RegExp, message: string) => z.string().trim().regex(re, message);

export const SETTINGS = {
  risk: z.object({
    inactiveDays: z.number().int().min(1, "Поне 1 ден").max(60, "До 60 дни"),
    minCompletionPct: z.number().int().min(0).max(100),
  }),
  payment_provider: z.object({ provider: z.enum(["stripe", "revolut"]) }),
  tracking: z.object({
    metaPixelId: optionalId(/^\d{0,20}$/, "Само цифри"),
    ga4Id: optionalId(/^(G-[A-Z0-9]{4,12})?$/, "Формат G-XXXXXXX"),
    gtmId: optionalId(/^(GTM-[A-Z0-9]{4,10})?$/, "Формат GTM-XXXXXX"),
    googleAdsId: optionalId(/^(AW-\d{6,12})?$/, "Формат AW-123456789"),
  }),
  email_templates: z.object({
    nudgeSubject: z.string().trim().min(1, "Нужна е тема").max(150),
    nudgeBody: z.string().trim().min(1, "Нужен е текст").max(4000),
  }),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]>;
export type Settings = { [K in SettingKey]: SettingValue<K> };

export const SETTING_DEFAULTS: Settings = {
  risk: { inactiveDays: 5, minCompletionPct: 50 },
  payment_provider: { provider: "stripe" },
  tracking: { metaPixelId: "", ga4Id: "", gtmId: "", googleAdsId: "" },
  email_templates: {
    nudgeSubject: "Липсваш ни, {{name}}",
    nudgeBody:
      "Здравей, {{name}}!\n\nНе сме те виждали от няколко дни. Днешната тренировка те чака — 20 минути стигат.\n\nДо скоро!",
  },
};

export function parseSetting<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> {
  const parsed = SETTINGS[key].safeParse(raw);
  return (parsed.success ? parsed.data : SETTING_DEFAULTS[key]) as SettingValue<K>;
}

export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (match, name: string) => vars[name] ?? match);
}
```

`src/lib/form-data.ts`:

```ts
export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formInt(form: FormData, key: string): number {
  const raw = formString(form, key);
  return /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
}

export function formBool(form: FormData, key: string): boolean {
  const value = formString(form, key);
  return value === "on" || value === "true" || value === "1";
}

export function formList(form: FormData, key: string): string[] {
  return form.getAll(key).filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
}
```

In `src/lib/video/parse-video-url.ts` add, and use it at the top of `parseVideoUrl` (`let url: URL; try { url = new URL(normalizeVideoInput(raw)); } …`):

```ts
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Adds https:// to links pasted without a scheme ("youtu.be/ID", "www.youtube.com/watch?v=…"). */
export function normalizeVideoInput(raw: string): string {
  const trimmed = raw.trim();
  return SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test`
Expected: PASS (all unit files).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: admin domain logic — time zones, scheduling, calendar, risk rules, settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Admin gate, TOTP enrolment page, panel layout and navigation

**Files:**
- Create: `src/server/admin/require-admin.ts`, `src/app/admin/mfa/page.tsx`, `src/app/admin/mfa/mfa-form.tsx`, `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/page.tsx` (temporary heading, replaced in Task 11), `src/components/admin/admin-nav.tsx`, `src/components/admin/action-form.tsx`, `src/components/admin/level-badge.tsx`, `src/components/admin/status-badge.tsx`, `scripts/make-admin.mjs`, `supabase/tests/admin-guard.test.ts`
- Modify: `src/lib/app-error.ts` (+ `"MFA_REQUIRED"`)

**Interfaces:**
- Consumes: `requireUser()`, `AppError`, `ActionResult`, `LEVEL_LABEL`, `WorkoutStatus`.
- Produces:
  - `adminAccess(db: TypedClient, userId: string): Promise<"ok" | "not_admin" | "mfa_required">` (pure DB check, testable)
  - `requireAdmin(): Promise<{ user: User; supabase: TypedClient }>` — throws `AppError("UNAUTHORIZED")`, `AppError("FORBIDDEN")` or `AppError("MFA_REQUIRED")`
  - `<ActionForm action={(prev, form) => Promise<ActionResult<unknown>>} submitLabel="…" className? resetOnSuccess?>{fields}</ActionForm>`
  - `<LevelBadge level />`, `<StatusBadge status />`, `<AdminNav />`

- [ ] **Step 1: Write the failing guard test**

`supabase/tests/admin-guard.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { adminAccess } from "@/server/admin/require-admin";
import { adminClient, createAal1Admin, createAdminUser, createUser, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;
beforeAll(() => {
  admin = adminClient();
});

describe("adminAccess", () => {
  it("separates clients, half-signed-in admins and real admins", async () => {
    const client = await createUser(admin, "guard-client");
    expect(await adminAccess(await signedInClient(client), client.id)).toBe("not_admin");
    const half = await createAal1Admin(admin, "guard-half");
    expect(await adminAccess(half.db, half.user.id)).toBe("mfa_required");
    const full = await createAdminUser(admin, "guard-full");
    expect(await adminAccess(full.db, full.user.id)).toBe("ok");
  });
});
```

Run: `pnpm test:db supabase/tests/admin-guard.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement the guard**

In `src/lib/app-error.ts` extend the union: `| "MFA_REQUIRED"`.

`src/server/admin/require-admin.ts`:

```ts
import { AppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import type { TypedClient } from "@/server/db/types";

/** Role admin AND a session that passed TOTP (aal2). The DB enforces the same through is_admin(). */
export async function adminAccess(
  db: TypedClient,
  userId: string,
): Promise<"ok" | "not_admin" | "mfa_required"> {
  const { data: profile, error } = await db.from("profiles").select("role").eq("id", userId).single();
  if (error) throw new Error(`load role failed: ${error.message}`);
  if (profile.role !== "admin") return "not_admin";
  const { data: aal, error: aalError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw new Error(`load assurance level failed: ${aalError.message}`);
  return aal.currentLevel === "aal2" ? "ok" : "mfa_required";
}

/** For admin pages and server actions. */
export async function requireAdmin() {
  const { user, supabase } = await requireUser();
  const access = await adminAccess(supabase, user.id);
  if (access === "not_admin") throw new AppError("FORBIDDEN", "Нямаш достъп.");
  if (access === "mfa_required") throw new AppError("MFA_REQUIRED", "Потвърди входа с код от приложението за автентикация.");
  return { user, supabase };
}
```

Run: `pnpm test:db supabase/tests/admin-guard.test.ts` → PASS.

- [ ] **Step 3: Panel layout, nav, shared admin components**

`src/app/admin/(panel)/layout.tsx`:

```tsx
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAppError } from "@/lib/app-error";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: { default: "Админ", template: "%s · Админ" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection();
  try {
    await requireAdmin();
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHORIZED") redirect("/login?next=/admin");
    if (isAppError(error) && error.code === "MFA_REQUIRED") redirect("/admin/mfa");
    if (isAppError(error) && error.code === "FORBIDDEN") notFound();
    throw error;
  }
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[220px_1fr]">
      <AdminNav />
      <main className="min-w-0 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
```

`src/app/admin/(panel)/page.tsx` (placeholder until Task 11):

```tsx
export default function AdminHome() {
  return <h1 className="font-display text-2xl font-bold">Табло</h1>;
}
```

`src/components/admin/admin-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Табло" },
  { href: "/admin/calendar", label: "Календар" },
  { href: "/admin/workouts", label: "Тренировки" },
  { href: "/admin/clients", label: "Клиентки" },
  { href: "/admin/activity", label: "Активност" },
  { href: "/admin/at-risk", label: "Изостават" },
  { href: "/admin/settings", label: "Настройки" },
  { href: "/admin/audit", label: "Одит" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-line bg-white lg:min-h-dvh lg:border-b-0 lg:border-r">
      <p className="px-4 pt-4 font-display text-lg font-bold">Админ</p>
      <ul className="flex gap-1 overflow-x-auto px-2 py-3 lg:flex-col">
        {ITEMS.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold",
                  active ? "bg-ink text-paper" : "text-ink-soft hover:bg-ink/5",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="lg:mt-4">
          <Link href="/app" className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-ink/5">
            ← Към приложението
          </Link>
        </li>
      </ul>
    </nav>
  );
}
```

`src/components/admin/action-form.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

type FormAction = (prev: ActionResult<unknown> | null, form: FormData) => Promise<ActionResult<unknown>>;

/** A form bound to a server action; shows the action's success or error message. */
export function ActionForm({
  action,
  submitLabel,
  successMessage = "Запазено ✓",
  resetOnSuccess = false,
  className,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={formRef} action={formAction} className={className ?? "space-y-3"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "…" : submitLabel}
        </Button>
        {state && (
          <p role="status" className={state.ok ? "text-sm text-moss" : "text-sm text-brick"}>
            {state.ok ? successMessage : state.message}
          </p>
        )}
      </div>
    </form>
  );
}
```

`src/components/admin/level-badge.tsx`:

```tsx
import { cn } from "@/lib/cn";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level } from "@/lib/program/types";

const TONE: Record<Level, string> = { beginner: "bg-moss", advanced: "bg-mustard", pro: "bg-brick" };

export function LevelBadge({ level }: { level: Level | null }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white", level ? TONE[level] : "bg-ember")}>
      {level ? LEVEL_LABEL[level] : "Всички"}
    </span>
  );
}
```

`src/components/admin/status-badge.tsx`:

```tsx
import { cn } from "@/lib/cn";
import type { WorkoutStatus } from "@/lib/admin/calendar";

const LABEL: Record<WorkoutStatus, string> = { draft: "Чернова", scheduled: "Планирана", published: "Публикувана" };
const TONE: Record<WorkoutStatus, string> = {
  draft: "bg-ink/10 text-ink",
  scheduled: "bg-mustard/20 text-ink",
  published: "bg-moss/20 text-moss",
};

export function StatusBadge({ status }: { status: WorkoutStatus }) {
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", TONE[status])}>{LABEL[status]}</span>;
}
```

- [ ] **Step 4: TOTP page**

`src/app/admin/mfa/page.tsx`:

```tsx
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerSupabaseClient } from "@/server/db/server";
import { adminAccess } from "@/server/admin/require-admin";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Потвърждение" };

export default function MfaPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
      <MfaGate />
    </Suspense>
  );
}

async function MfaGate() {
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/mfa");
  const access = await adminAccess(supabase, user.id);
  if (access === "not_admin") notFound();
  if (access === "ok") redirect("/admin");
  return <MfaForm />;
}
```

`src/app/admin/mfa/mfa-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Mode = { kind: "loading" } | { kind: "verify"; factorId: string } | { kind: "enroll"; factorId: string; qr: string; secret: string };

/** Enrols an authenticator app on first visit, then asks for the 6-digit code on every new session. */
export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setError("Не успяхме да заредим факторите. Опитай пак.");
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setMode({ kind: "verify", factorId: verified.id });
      for (const stale of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError || !enrolled) return setError("Не успяхме да започнем настройката. Опитай пак.");
      setMode({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
  }, []);

  async function onSubmit(form: FormData) {
    if (mode.kind === "loading" || busy) return;
    setBusy(true);
    setError("");
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    const { error: verifyError } = await createBrowserSupabaseClient().auth.mfa.challengeAndVerify({
      factorId: mode.factorId,
      code,
    });
    if (verifyError) {
      setBusy(false);
      return setError("Грешен или изтекъл код. Опитай пак.");
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="font-display text-2xl font-bold">Двуфакторна защита</h1>
      {mode.kind === "loading" && !error && <p>Зареждане…</p>}
      {mode.kind === "enroll" && (
        <section className="space-y-3">
          <p>Сканирай кода с Google Authenticator, 1Password или подобно приложение:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI from Supabase */}
          <img src={mode.qr} alt="QR код за приложението за автентикация" className="h-48 w-48 rounded-xl bg-white p-2" />
          <p className="break-all text-sm text-ink-soft">Или въведи ключа ръчно: {mode.secret}</p>
        </section>
      )}
      {mode.kind !== "loading" && (
        <form action={onSubmit} className="space-y-4">
          <Field label="6-цифрен код" error={error || undefined}>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required className={inputClass} />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Проверка…" : "Потвърди"}
          </Button>
        </form>
      )}
      {mode.kind === "loading" && error && <p role="alert" className="text-brick">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 5: Local admin script**

`scripts/make-admin.mjs`:

```js
// Usage: node --env-file=.env.local scripts/make-admin.mjs someone@example.test
// Local only. On a hosted project run: update public.profiles set role = 'admin' where email = '…';
import { createClient } from "@supabase/supabase-js";

const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL host "${host}" is not local.`);
  process.exit(1);
}
const [email] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/make-admin.mjs someone@example.test");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await db.from("profiles").update({ role: "admin" }).eq("email", email).select("id");
if (error) throw error;
if (!data.length) {
  console.error(`No profile with email ${email}.`);
  process.exit(1);
}
console.log(`${email} is now an admin (TOTP is set up on the first visit to /admin).`);
```

- [ ] **Step 6: Verify in the browser**

`pnpm typecheck && pnpm lint && pnpm build` → all exit 0. Then with the preview (`preview_start` name `fit-platform-dev`): create a user via `/start`, run `node --env-file=.env.local scripts/make-admin.mjs <email>`, open `/admin` → redirected to `/admin/mfa` with a QR code. Enrolment needs a real authenticator code: generate it from the shown secret with `node -e 'import("otpauth").then(({TOTP})=>console.log(new TOTP({secret:process.argv[1]}).generate()))' <SECRET>` and submit → lands on `/admin` with the nav. A plain client opening `/admin` gets the 404 page. Signed-out `/admin` → `/login?next=%2Fadmin`. No console errors. Reset viewport, `preview_stop`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(admin): TOTP-gated admin panel shell with enrolment page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Server integrations — video metadata, thumbnail copy, mailer

**Files:**
- Create: `src/server/admin/video-meta.ts`, `src/server/admin/video-meta.test.ts`, `src/server/admin/thumbnails.ts`, `supabase/tests/admin-thumbnails.test.ts`, `src/server/admin/mailer.ts`, `src/server/admin/mailer.test.ts`
- Modify: `src/lib/env-schema.ts` (+ optional `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`), `.env.example`

**Interfaces:**
- Consumes: `VideoRef` and `parseVideoUrl` (src/lib/video), `brand.name`, `TypedClient`.
- Produces:
  - `interface VideoMeta { title: string | null; durationMin: number | null; thumbnailSourceUrl: string | null }`; `fetchVideoMeta(ref: VideoRef, fetchImpl?: typeof fetch): Promise<VideoMeta>` (never throws; best effort)
  - `THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "i.vimeocdn.com"])`; `copyThumbnail(db: TypedClient, sourceUrl: string, fetchImpl?: typeof fetch): Promise<string | null>` (public URL in bucket `thumbnails` or null)
  - `interface Mailer { send(msg: { to: string; toName?: string; subject: string; text: string }): Promise<{ delivered: boolean }> }`; `createMailer(env: { BREVO_API_KEY?: string; EMAIL_FROM_ADDRESS?: string; EMAIL_FROM_NAME?: string }, fetchImpl?: typeof fetch): Mailer`

- [ ] **Step 1: Write the failing unit tests**

`src/server/admin/video-meta.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { parseVideoUrl } from "@/lib/video/parse-video-url";
import { fetchVideoMeta } from "./video-meta";

function fakeFetch(body: unknown, ok = true) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 404 })) as unknown as typeof fetch;
}

describe("fetchVideoMeta", () => {
  it("reads title and thumbnail from YouTube oEmbed (no duration)", async () => {
    const f = fakeFetch({ title: "Корем 20", thumbnail_url: "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg" });
    const meta = await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, f);
    expect(meta).toEqual({ title: "Корем 20", durationMin: null, thumbnailSourceUrl: "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg" });
    const called = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(called).toBe("https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dml6cT4AZdqI");
  });

  it("reads duration from Vimeo and keeps the unlisted hash", async () => {
    const f = fakeFetch({ title: "Стречинг", duration: 1530, thumbnail_url: "https://i.vimeocdn.com/video/1.jpg" });
    const meta = await fetchVideoMeta(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")!, f);
    expect(meta).toEqual({ title: "Стречинг", durationMin: 26, thumbnailSourceUrl: "https://i.vimeocdn.com/video/1.jpg" });
    const called = String((f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]);
    expect(called).toContain(encodeURIComponent("https://vimeo.com/76979871/8272103f6e"));
  });

  it("drops thumbnails from unexpected hosts and survives errors", async () => {
    const evil = fakeFetch({ title: "x", thumbnail_url: "https://evil.example/x.jpg" });
    expect((await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, evil)).thumbnailSourceUrl).toBeNull();
    const down = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, down)).toEqual({ title: null, durationMin: null, thumbnailSourceUrl: null });
    const missing = fakeFetch({}, false);
    expect((await fetchVideoMeta(parseVideoUrl("https://youtu.be/ml6cT4AZdqI")!, missing)).title).toBeNull();
  });

  it("returns nothing for Bunny (no oEmbed)", async () => {
    const f = fakeFetch({});
    const ref = parseVideoUrl("https://iframe.mediadelivery.net/embed/123456/0c1f6d0e-7c2a-4d8e-9a55-2f8a6b1e9c11")!;
    expect(await fetchVideoMeta(ref, f)).toEqual({ title: null, durationMin: null, thumbnailSourceUrl: null });
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });
});
```

`src/server/admin/mailer.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createMailer } from "./mailer";

describe("createMailer", () => {
  it("sends through Brevo when configured", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ messageId: "m1" }), { status: 201 })) as unknown as typeof fetch;
    const mailer = createMailer({ BREVO_API_KEY: "k", EMAIL_FROM_ADDRESS: "hi@example.com", EMAIL_FROM_NAME: "Форма" }, f);
    expect(await mailer.send({ to: "ani@example.test", toName: "Ани", subject: "Тема", text: "Текст" })).toEqual({ delivered: true });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("k");
    expect(JSON.parse(String(init.body))).toEqual({
      sender: { name: "Форма", email: "hi@example.com" },
      to: [{ email: "ani@example.test", name: "Ани" }],
      subject: "Тема",
      textContent: "Текст",
    });
  });

  it("reports a Brevo failure as not delivered", async () => {
    const f = vi.fn(async () => new Response("bad", { status: 400 })) as unknown as typeof fetch;
    const mailer = createMailer({ BREVO_API_KEY: "k", EMAIL_FROM_ADDRESS: "hi@example.com" }, f);
    expect(await mailer.send({ to: "a@example.test", subject: "s", text: "t" })).toEqual({ delivered: false });
  });

  it("falls back to a no-op mailer without configuration", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(await createMailer({}, f).send({ to: "a@example.test", subject: "s", text: "t" })).toEqual({ delivered: false });
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });
});
```

Run: `pnpm test src/server/admin` → FAIL (modules missing).

- [ ] **Step 2: Implement**

`src/server/admin/video-meta.ts`:

```ts
import type { VideoRef } from "@/lib/video/parse-video-url";

export interface VideoMeta {
  title: string | null;
  durationMin: number | null;
  thumbnailSourceUrl: string | null;
}

export const THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "i.vimeocdn.com"]);
const NONE: VideoMeta = { title: null, durationMin: null, thumbnailSourceUrl: null };

function safeThumb(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && THUMBNAIL_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function oembedUrl(ref: VideoRef): string | null {
  if (ref.provider === "youtube") {
    const page = `https://www.youtube.com/watch?v=${ref.id}`;
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(page)}`;
  }
  if (ref.provider === "vimeo") {
    const hash = new URL(ref.embedUrl).searchParams.get("h");
    const page = `https://vimeo.com/${ref.id}${hash ? `/${hash}` : ""}`;
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}`;
  }
  return null;
}

/** Title, duration (Vimeo only) and a provider thumbnail URL. Best effort: never throws. */
export async function fetchVideoMeta(ref: VideoRef, fetchImpl: typeof fetch = fetch): Promise<VideoMeta> {
  const url = oembedUrl(ref);
  if (!url) return NONE;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return NONE;
    const body = (await res.json()) as { title?: unknown; duration?: unknown; thumbnail_url?: unknown };
    return {
      title: typeof body.title === "string" ? body.title.slice(0, 120) : null,
      durationMin: typeof body.duration === "number" && body.duration > 0 ? Math.max(1, Math.round(body.duration / 60)) : null,
      thumbnailSourceUrl: safeThumb(body.thumbnail_url),
    };
  } catch {
    return NONE;
  }
}
```

`src/server/admin/thumbnails.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { TypedClient } from "@/server/db/types";
import { THUMBNAIL_HOSTS } from "./video-meta";

const MAX_BYTES = 2 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Copies a provider thumbnail into our public bucket under a random name, so the stored URL never
 * contains the video ID. Uses the admin's session (storage RLS: admins only). Null on any failure.
 */
export async function copyThumbnail(
  db: TypedClient,
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !THUMBNAIL_HOSTS.has(url.hostname)) return null;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const ext = EXT[type];
    if (!res.ok || !ext) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;
    const path = `${randomUUID()}.${ext}`;
    const { error } = await db.storage.from("thumbnails").upload(path, bytes, { contentType: type });
    if (error) return null;
    return db.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
```

`src/server/admin/mailer.ts`:

```ts
import { brand } from "@/lib/brand";

export interface Mailer {
  send(msg: { to: string; toName?: string; subject: string; text: string }): Promise<{ delivered: boolean }>;
}

/** Brevo transactional email when configured; otherwise a mailer that delivers nothing. */
export function createMailer(
  env: { BREVO_API_KEY?: string; EMAIL_FROM_ADDRESS?: string; EMAIL_FROM_NAME?: string },
  fetchImpl: typeof fetch = fetch,
): Mailer {
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM_ADDRESS) {
    return { send: async () => ({ delivered: false }) };
  }
  const sender = { name: env.EMAIL_FROM_NAME ?? brand.name, email: env.EMAIL_FROM_ADDRESS };
  return {
    async send(msg) {
      try {
        const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender,
            to: [{ email: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }],
            subject: msg.subject,
            textContent: msg.text,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        return { delivered: res.ok };
      } catch {
        return { delivered: false };
      }
    },
  };
}
```

In `src/lib/env-schema.ts` add to `serverEnvSchema`:

```ts
  // Optional: without them „Изпрати съобщение" records the note but sends nothing.
  BREVO_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_ADDRESS: z.email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).max(60).optional(),
```

and append to `.env.example`:

```
# Optional (admin „Изпрати съобщение")
BREVO_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=
```

(Empty values in `.env.local` must not break parsing: if `BREVO_API_KEY=` yields `""`, wrap these three with `z.preprocess((v) => (v === "" ? undefined : v), …)`.)

- [ ] **Step 3: Thumbnail DB test**

`supabase/tests/admin-thumbnails.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from "vitest";
import { copyThumbnail } from "@/server/admin/thumbnails";
import { adminClient, createAdminUser, type TypedClient } from "./helpers";

// 1×1 transparent PNG
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
let boss: TypedClient;

beforeAll(async () => {
  boss = (await createAdminUser(adminClient(), "thumb-admin")).db;
});

const image = () => vi.fn(async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } })) as unknown as typeof fetch;

describe("copyThumbnail", () => {
  it("stores the image under a random name in our bucket", async () => {
    const url = await copyThumbnail(boss, "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg", image());
    expect(url).toMatch(/\/storage\/v1\/object\/public\/thumbnails\/[0-9a-f-]{36}\.png$/);
    expect(url).not.toContain("ml6cT4AZdqI");
    expect((await fetch(url!)).status).toBe(200);
  });

  it("refuses foreign hosts, non-images and failures", async () => {
    expect(await copyThumbnail(boss, "https://evil.example/x.png", image())).toBeNull();
    const html = vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    expect(await copyThumbnail(boss, "https://i.ytimg.com/x.jpg", html)).toBeNull();
    const down = vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await copyThumbnail(boss, "https://i.ytimg.com/x.jpg", down)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test && pnpm test:db supabase/tests/admin-thumbnails.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(admin): video metadata via oEmbed, thumbnail copy to own bucket, Brevo mailer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Admin workouts — service and pages (list, create, edit, schedule, starter order)

**Files:**
- Create: `src/server/admin/workouts.ts`, `supabase/tests/admin-workouts.test.ts`, `src/app/admin/(panel)/workouts/page.tsx`, `src/app/admin/(panel)/workouts/new/page.tsx`, `src/app/admin/(panel)/workouts/[id]/page.tsx`, `src/app/admin/(panel)/workouts/workout-form.tsx`, `src/app/admin/(panel)/workouts/starter-order.tsx`, `src/app/admin/(panel)/workouts/actions.ts`

**Interfaces:**
- Consumes: `parseVideoUrl`, `normalizeVideoInput`, `workoutStatus`, `WorkoutStatus`, `zonedToUtc`, `utcToZoned`, `ADMIN_TZ`, `FOCUS`, `requireAdmin`, `ActionForm`, `LevelBadge`, `StatusBadge`, `AppError`, form-data helpers.
- Produces:
  - `workoutInputSchema` (zod) → `WorkoutInput { title; description; kind; level: Level | null; durationMin; focus: Focus[]; videoUrl; thumbnailUrl: string | null; publishAt: string | null; notify: boolean }`
  - `interface AdminWorkout { id; title; description; kind: WorkoutKind; level: Level | null; durationMin; focus: string[]; thumbnailUrl: string | null; publishAt: string | null; notify: boolean; starterOrder: number | null; videoUrl: string | null; status: WorkoutStatus; completions: number }`
  - `listAdminWorkouts(db, filter?: { level?: Level; kind?: WorkoutKind; status?: WorkoutStatus; search?: string }, now?: Date): Promise<AdminWorkout[]>`
  - `getAdminWorkout(db, id): Promise<AdminWorkout | null>`
  - `createAdminWorkout(db, userId, raw: unknown): Promise<string>`; `updateAdminWorkout(db, id, raw: unknown): Promise<void>`
  - `scheduleWorkout(db, id, publishAt: string | null): Promise<void>`; `moveWorkoutToDate(db, id, date: string): Promise<void>` (keeps the Sofia time, default 07:00)
  - `deleteAdminWorkout(db, id): Promise<void>` (CONFLICT when completed)
  - `reorderStarters(db, ids: string[]): Promise<void>`

- [ ] **Step 1: Write the failing DB tests**

`supabase/tests/admin-workouts.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  createAdminWorkout,
  deleteAdminWorkout,
  getAdminWorkout,
  listAdminWorkouts,
  moveWorkoutToDate,
  scheduleWorkout,
  updateAdminWorkout,
} from "@/server/admin/workouts";
import { adminClient, createAdminUser, createUser, freeWorkoutId, signedInClient, type TypedClient } from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;

beforeAll(async () => {
  admin = adminClient();
  const created = await createAdminUser(admin, "wk-admin");
  boss = created.db;
  bossId = created.user.id;
});

const input = (over: Record<string, unknown> = {}) => ({
  title: "Корем 25",
  description: "",
  kind: "regular",
  level: "advanced",
  durationMin: 25,
  focus: ["core"],
  videoUrl: "youtu.be/ml6cT4AZdqI",
  thumbnailUrl: null,
  publishAt: null,
  notify: true,
  ...over,
});

describe("admin workouts service", () => {
  it("creates a draft with normalised media and reads it back", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    const w = await getAdminWorkout(boss, id);
    expect(w).toMatchObject({ title: "Корем 25", status: "draft", videoUrl: "https://youtu.be/ml6cT4AZdqI", completions: 0, level: "advanced" });
  });

  it("rejects a non-video link and a regular workout without level", async () => {
    await expect(createAdminWorkout(boss, bossId, input({ videoUrl: "https://example.com/v" }))).rejects.toThrow();
    await expect(createAdminWorkout(boss, bossId, input({ level: null }))).rejects.toThrow();
  });

  it("appends a new starter at the end of the starter week", async () => {
    const id = await createAdminWorkout(boss, bossId, input({ kind: "starter", level: null, title: "Старт 6" }));
    const w = await getAdminWorkout(boss, id);
    const { data } = await admin.from("workouts").select("starter_order").eq("kind", "starter").order("starter_order", { ascending: false }).limit(1).single();
    expect(w?.starterOrder).toBe(data?.starter_order);
    await deleteAdminWorkout(boss, id);
  });

  it("refuses a second free workout", async () => {
    await expect(createAdminWorkout(boss, bossId, input({ kind: "free", level: null }))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates metadata and the link", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await updateAdminWorkout(boss, id, input({ title: "Корем 30", durationMin: 30, videoUrl: "https://vimeo.com/76979871" }));
    expect(await getAdminWorkout(boss, id)).toMatchObject({ title: "Корем 30", durationMin: 30, videoUrl: "https://vimeo.com/76979871" });
  });

  it("schedules, moves to another day keeping the Sofia time, and hides again", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await scheduleWorkout(boss, id, "2031-10-20T15:30:00.000Z"); // 18:30 Sofia
    await moveWorkoutToDate(boss, id, "2031-10-28");               // after DST end → 16:30Z
    expect((await getAdminWorkout(boss, id))?.publishAt).toBe("2031-10-28T16:30:00+00:00");
    await scheduleWorkout(boss, id, null);
    expect((await getAdminWorkout(boss, id))?.status).toBe("draft");
  });

  it("moves a draft to 07:00 Sofia on the chosen day", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await moveWorkoutToDate(boss, id, "2031-12-02");
    expect((await getAdminWorkout(boss, id))?.publishAt).toBe("2031-12-02T05:00:00+00:00");
  });

  it("deletes an unused workout and refuses a completed one, keeping its history", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await deleteAdminWorkout(boss, id);
    expect(await getAdminWorkout(boss, id)).toBeNull();
    const freeId = await freeWorkoutId(admin);
    const member = await signedInClient(await createUser(admin, "wk-done"));
    await member.from("workout_completions").insert({ workout_id: freeId });
    await expect(deleteAdminWorkout(boss, freeId)).rejects.toMatchObject({ code: "CONFLICT" });
    const { count } = await admin.from("workout_completions").select("id", { count: "exact", head: true }).eq("workout_id", freeId);
    expect(count).toBeGreaterThan(0);
  });

  it("lists with filters and completion counts", async () => {
    const id = await createAdminWorkout(boss, bossId, input({ title: `Филтър ${Date.now()}`, level: "pro" }));
    const found = await listAdminWorkouts(boss, { level: "pro", status: "draft", search: "Филтър" });
    expect(found.map((w) => w.id)).toContain(id);
    const free = (await listAdminWorkouts(boss, { kind: "free" }))[0];
    expect(free?.completions).toBeGreaterThan(0);
  });
});
```

Run: `pnpm test:db supabase/tests/admin-workouts.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement the service**

`src/server/admin/workouts.ts`:

```ts
import { z } from "zod";
import { workoutStatus, type WorkoutStatus } from "@/lib/admin/calendar";
import { utcToZoned, zonedToUtc } from "@/lib/admin/time";
import { AppError } from "@/lib/app-error";
import { FOCUS } from "@/lib/labels";
import type { Level, WorkoutKind } from "@/lib/program/types";
import { normalizeVideoInput, parseVideoUrl } from "@/lib/video/parse-video-url";
import type { TypedClient } from "@/server/db/types";

export const workoutInputSchema = z
  .object({
    title: z.string().trim().min(1, "Нужно е заглавие").max(120),
    description: z.string().trim().max(2000).default(""),
    kind: z.enum(["free", "starter", "regular"]),
    level: z.enum(["beginner", "advanced", "pro"]).nullable(),
    durationMin: z.number().int().min(1, "Поне 1 минута").max(180),
    focus: z.array(z.enum(FOCUS)).max(FOCUS.length),
    videoUrl: z.string().trim().min(1, "Нужен е линк").max(500),
    thumbnailUrl: z.url().nullable(),
    publishAt: z.iso.datetime({ offset: true }).nullable(),
    notify: z.boolean(),
  })
  .refine((w) => (w.kind === "regular") === (w.level !== null), {
    path: ["level"],
    message: "Обикновената тренировка има ниво; безплатната и стартовите — не.",
  })
  .refine((w) => parseVideoUrl(w.videoUrl) !== null, {
    path: ["videoUrl"],
    message: "Не разпознавам линка (YouTube, Vimeo или Bunny).",
  });

export type WorkoutInput = z.infer<typeof workoutInputSchema>;

export interface AdminWorkout {
  id: string;
  title: string;
  description: string;
  kind: WorkoutKind;
  level: Level | null;
  durationMin: number;
  focus: string[];
  thumbnailUrl: string | null;
  publishAt: string | null;
  notify: boolean;
  starterOrder: number | null;
  videoUrl: string | null;
  status: WorkoutStatus;
  completions: number;
}

const COLUMNS =
  "id, title, description, kind, level, duration_min, focus, thumbnail_url, publish_at, notify, starter_order, workout_media(video_url), workout_completions(count)";

type Row = {
  id: string;
  title: string;
  description: string;
  kind: WorkoutKind;
  level: Level | null;
  duration_min: number;
  focus: string[];
  thumbnail_url: string | null;
  publish_at: string | null;
  notify: boolean;
  starter_order: number | null;
  workout_media: { video_url: string } | { video_url: string }[] | null;
  workout_completions: { count: number }[];
};

function toAdminWorkout(r: Row, now: Date): AdminWorkout {
  const media = Array.isArray(r.workout_media) ? r.workout_media[0] : r.workout_media;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    level: r.level,
    durationMin: r.duration_min,
    focus: r.focus,
    thumbnailUrl: r.thumbnail_url,
    publishAt: r.publish_at,
    notify: r.notify,
    starterOrder: r.starter_order,
    videoUrl: media?.video_url ?? null,
    status: workoutStatus(r.publish_at, now),
    completions: r.workout_completions[0]?.count ?? 0,
  };
}

export async function listAdminWorkouts(
  db: TypedClient,
  filter: { level?: Level; kind?: WorkoutKind; status?: WorkoutStatus; search?: string } = {},
  now = new Date(),
): Promise<AdminWorkout[]> {
  let query = db.from("workouts").select(COLUMNS).order("publish_at", { ascending: false, nullsFirst: true }).limit(500);
  if (filter.level) query = query.eq("level", filter.level);
  if (filter.kind) query = query.eq("kind", filter.kind);
  if (filter.search) query = query.ilike("title", `%${filter.search.replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error(`list workouts failed: ${error.message}`);
  const rows = (data as unknown as Row[]).map((r) => toAdminWorkout(r, now));
  return filter.status ? rows.filter((w) => w.status === filter.status) : rows;
}

export async function getAdminWorkout(db: TypedClient, id: string, now = new Date()): Promise<AdminWorkout | null> {
  const { data, error } = await db.from("workouts").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`load workout failed: ${error.message}`);
  return data ? toAdminWorkout(data as unknown as Row, now) : null;
}

async function nextStarterOrder(db: TypedClient): Promise<number> {
  const { data, error } = await db
    .from("workouts")
    .select("starter_order")
    .eq("kind", "starter")
    .order("starter_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load starter order failed: ${error.message}`);
  return (data?.starter_order ?? 0) + 1;
}

function rowFields(w: WorkoutInput) {
  return {
    title: w.title,
    description: w.description,
    kind: w.kind,
    level: w.kind === "regular" ? w.level : null,
    duration_min: w.durationMin,
    focus: w.focus,
    thumbnail_url: w.thumbnailUrl,
    publish_at: w.publishAt,
    notify: w.notify,
  };
}

export async function createAdminWorkout(db: TypedClient, userId: string, raw: unknown): Promise<string> {
  const w = workoutInputSchema.parse(raw);
  const ref = parseVideoUrl(w.videoUrl)!;
  const starter_order = w.kind === "starter" ? await nextStarterOrder(db) : null;
  const { data, error } = await db
    .from("workouts")
    .insert({ ...rowFields(w), starter_order, created_by: userId })
    .select("id")
    .single();
  if (error?.code === "23505") throw new AppError("CONFLICT", "Вече има безплатна тренировка.");
  if (error) throw new Error(`create workout failed: ${error.message}`);
  const media = await db
    .from("workout_media")
    .insert({ workout_id: data.id, provider: ref.provider, video_url: normalizeVideoInput(w.videoUrl) });
  if (media.error) {
    await db.from("workouts").delete().eq("id", data.id);
    throw new Error(`save video link failed: ${media.error.message}`);
  }
  return data.id;
}

export async function updateAdminWorkout(db: TypedClient, id: string, raw: unknown): Promise<void> {
  const w = workoutInputSchema.parse(raw);
  const ref = parseVideoUrl(w.videoUrl)!;
  const current = await getAdminWorkout(db, id);
  if (!current) throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
  const starter_order =
    w.kind === "starter" ? (current.kind === "starter" ? current.starterOrder : await nextStarterOrder(db)) : null;
  const { error } = await db.from("workouts").update({ ...rowFields(w), starter_order }).eq("id", id);
  if (error?.code === "23505") throw new AppError("CONFLICT", "Вече има безплатна тренировка.");
  if (error) throw new Error(`update workout failed: ${error.message}`);
  const media = await db
    .from("workout_media")
    .upsert({ workout_id: id, provider: ref.provider, video_url: normalizeVideoInput(w.videoUrl) }, { onConflict: "workout_id" });
  if (media.error) throw new Error(`save video link failed: ${media.error.message}`);
}

export async function scheduleWorkout(db: TypedClient, id: string, publishAt: string | null): Promise<void> {
  const value = publishAt === null ? null : z.iso.datetime({ offset: true }).parse(publishAt);
  const { data, error } = await db.from("workouts").update({ publish_at: value }).eq("id", id).select("id");
  if (error) throw new Error(`schedule workout failed: ${error.message}`);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
}

/** Calendar drag & drop: same Sofia time on the new day (07:00 for drafts). */
export async function moveWorkoutToDate(db: TypedClient, id: string, date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError("INVALID", "Невалидна дата.");
  const current = await getAdminWorkout(db, id);
  if (!current) throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
  const time = current.publishAt ? utcToZoned(current.publishAt).time : "07:00";
  await scheduleWorkout(db, id, zonedToUtc(date, time));
}

export async function deleteAdminWorkout(db: TypedClient, id: string): Promise<void> {
  const { data, error } = await db.from("workouts").delete().eq("id", id).select("id");
  if (error) throw new Error(`delete workout failed: ${error.message}`);
  if (data.length > 0) return;
  const exists = await getAdminWorkout(db, id);
  if (exists) throw new AppError("CONFLICT", "Клиентки са я завършили — скрий я (чернова) вместо да я триеш.");
  throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
}

export async function reorderStarters(db: TypedClient, ids: string[]): Promise<void> {
  const { error } = await db.rpc("admin_reorder_starters", { p_ids: ids });
  if (error?.code === "22023") throw new AppError("INVALID", "Подредбата трябва да съдържа всички стартови тренировки.");
  if (error) throw new Error(`reorder failed: ${error.message}`);
}
```

Run: `pnpm test:db supabase/tests/admin-workouts.test.ts` → PASS. (If `publishAt` comes back as `…Z` instead of `+00:00`, compare with `Date.parse` in the two schedule tests.)

- [ ] **Step 3: Server actions**

`src/app/admin/(panel)/workouts/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { zonedToUtc } from "@/lib/admin/time";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formBool, formInt, formList, formString } from "@/lib/form-data";
import { requireAdmin } from "@/server/admin/require-admin";
import {
  createAdminWorkout,
  deleteAdminWorkout,
  reorderStarters,
  scheduleWorkout,
  updateAdminWorkout,
} from "@/server/admin/workouts";

function readWorkout(form: FormData) {
  const date = formString(form, "date");
  const time = formString(form, "time") || "07:00";
  const kind = formString(form, "kind");
  return {
    title: formString(form, "title"),
    description: formString(form, "description"),
    kind,
    level: kind === "regular" ? formString(form, "level") || null : null,
    durationMin: formInt(form, "durationMin"),
    focus: formList(form, "focus"),
    videoUrl: formString(form, "videoUrl"),
    thumbnailUrl: formString(form, "thumbnailUrl") || null,
    publishAt: date ? zonedToUtc(date, time) : null,
    notify: formBool(form, "notify"),
  };
}

export async function createWorkoutAction(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  let id: string;
  try {
    const { user, supabase } = await requireAdmin();
    id = await createAdminWorkout(supabase, user.id, readWorkout(form));
  } catch (error) {
    return actionFail(error);
  }
  revalidatePath("/admin/workouts");
  redirect(`/admin/workouts/${id}?saved=1`);
}

export async function updateWorkoutAction(id: string, _prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await updateAdminWorkout(supabase, id, readWorkout(form));
    revalidatePath("/admin/workouts");
    revalidatePath("/admin/calendar");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function unpublishWorkoutAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await scheduleWorkout(supabase, id, null);
    revalidatePath("/admin/workouts");
    revalidatePath("/admin/calendar");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteWorkoutAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await deleteAdminWorkout(supabase, id);
  } catch (error) {
    return actionFail(error);
  }
  revalidatePath("/admin/workouts");
  redirect("/admin/workouts");
}

export async function reorderStartersAction(ids: string[]): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await reorderStarters(supabase, ids);
    revalidatePath("/admin/workouts");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
```

- [ ] **Step 4: Pages**

`src/app/admin/(panel)/workouts/workout-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import type { ActionResult } from "@/lib/action-result";
import { FOCUS, FOCUS_LABEL, LEVEL_LABEL } from "@/lib/labels";
import type { AdminWorkout } from "@/server/admin/workouts";
import { deleteWorkoutAction, unpublishWorkoutAction } from "./actions";

type FormAction = (prev: ActionResult<unknown> | null, form: FormData) => Promise<ActionResult<unknown>>;

export function WorkoutForm({ action, workout }: { action: FormAction; workout?: AdminWorkout }) {
  const [kind, setKind] = useState(workout?.kind ?? "regular");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const when = workout?.publishAt ? utcToZoned(workout.publishAt) : null;

  function run(fn: () => Promise<ActionResult<null>>) {
    startTransition(async () => {
      const result = await fn();
      setMessage(result.ok ? "Готово ✓" : result.message);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <ActionForm action={action} submitLabel={workout ? "Запази" : "Създай"}>
        <Field label="Заглавие">
          <input name="title" defaultValue={workout?.title} required maxLength={120} className={inputClass} />
        </Field>
        <Field label="Линк към видеото" hint="YouTube (скрит), Vimeo или Bunny">
          <input name="videoUrl" defaultValue={workout?.videoUrl ?? ""} required className={inputClass} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Вид">
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass}>
              <option value="regular">Обикновена</option>
              <option value="starter">Стартова седмица</option>
              <option value="free">Безплатна</option>
            </select>
          </Field>
          {kind === "regular" && (
            <Field label="Ниво">
              <select name="level" defaultValue={workout?.level ?? "beginner"} className={inputClass}>
                {Object.entries(LEVEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Минути">
            <input name="durationMin" type="number" min={1} max={180} step={1} defaultValue={workout?.durationMin ?? 30} required className={inputClass} />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Зони</legend>
          <div className="flex flex-wrap gap-3">
            {FOCUS.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="focus" value={f} defaultChecked={workout?.focus.includes(f)} />
                {FOCUS_LABEL[f]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Описание (по желание)">
          <textarea name="description" defaultValue={workout?.description} maxLength={2000} rows={3} className={inputClass + " h-auto py-3"} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Дата на публикуване" hint="Празно = чернова. Време в София.">
            <input name="date" type="date" defaultValue={when?.date ?? ""} className={inputClass} />
          </Field>
          <Field label="Час">
            <input name="time" type="time" defaultValue={when?.time ?? "07:00"} className={inputClass} />
          </Field>
        </div>
        <input type="hidden" name="thumbnailUrl" value={workout?.thumbnailUrl ?? ""} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked={workout?.notify ?? true} /> Изпрати известие при публикуване
        </label>
      </ActionForm>

      {workout && (
        <section className="flex flex-wrap gap-3 border-t border-line pt-4">
          <a href={`/app/workout/${workout.id}`} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
            Преглед като клиентка
          </a>
          {workout.publishAt && (
            <Button variant="quiet" size="md" disabled={pending} onClick={() => run(() => unpublishWorkoutAction(workout.id))}>
              Скрий (чернова)
            </Button>
          )}
          {workout.completions === 0 && (
            <Button
              variant="quiet"
              size="md"
              disabled={pending}
              className="text-brick"
              onClick={() => confirm("Да изтрия ли тренировката?") && run(() => deleteWorkoutAction(workout.id))}
            >
              Изтрий
            </Button>
          )}
          {message && <p role="status" className="text-sm">{message}</p>}
        </section>
      )}
    </div>
  );
}
```

`src/app/admin/(panel)/workouts/new/page.tsx`:

```tsx
import { createWorkoutAction } from "../actions";
import { WorkoutForm } from "../workout-form";

export const metadata = { title: "Нова тренировка" };

export default function NewWorkoutPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Нова тренировка</h1>
      <WorkoutForm action={createWorkoutAction} />
    </div>
  );
}
```

`src/app/admin/(panel)/workouts/[id]/page.tsx`:

```tsx
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdmin } from "@/server/admin/require-admin";
import { getAdminWorkout } from "@/server/admin/workouts";
import { updateWorkoutAction } from "../actions";
import { WorkoutForm } from "../workout-form";

export const metadata = { title: "Тренировка" };

export default function EditWorkoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <EditWorkout params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditWorkout({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await connection();
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const workout = /^[0-9a-f-]{36}$/i.test(id) ? await getAdminWorkout(supabase, id) : null;
  if (!workout) notFound();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">{workout.title}</h1>
        <StatusBadge status={workout.status} />
        <span className="text-sm text-ink-soft">{workout.completions} завършвания</span>
      </header>
      {saved && <p className="text-moss">Създадена ✓</p>}
      <WorkoutForm action={updateWorkoutAction.bind(null, workout.id)} workout={workout} />
    </div>
  );
}
```

`src/app/admin/(panel)/workouts/starter-order.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { AdminWorkout } from "@/server/admin/workouts";
import { reorderStartersAction } from "./actions";

export function StarterOrder({ starters }: { starters: AdminWorkout[] }) {
  const [items, setItems] = useState(starters);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function move(index: number, delta: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setItems(next);
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="font-semibold">Стартова седмица (ред)</h2>
      <ol className="space-y-2">
        {items.map((w, i) => (
          <li key={w.id} className="flex items-center gap-2 text-sm">
            <span className="w-6 text-ink-soft">{i + 1}.</span>
            <span className="flex-1">{w.title}</span>
            <Button variant="quiet" size="md" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Нагоре">↑</Button>
            <Button variant="quiet" size="md" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Надолу">↓</Button>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <Button
          size="md"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await reorderStartersAction(items.map((w) => w.id));
              setMessage(r.ok ? "Подредбата е запазена ✓" : r.message);
            })
          }
        >
          Запази реда
        </Button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </div>
    </section>
  );
}
```

`src/app/admin/(panel)/workouts/page.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level, WorkoutKind } from "@/lib/program/types";
import { requireAdmin } from "@/server/admin/require-admin";
import { listAdminWorkouts } from "@/server/admin/workouts";
import type { WorkoutStatus } from "@/lib/admin/calendar";
import { StarterOrder } from "./starter-order";

export const metadata = { title: "Тренировки" };
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default function WorkoutsPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Workouts searchParams={searchParams} />
    </Suspense>
  );
}

async function Workouts({ searchParams }: { searchParams: Search }) {
  await connection();
  const sp = await searchParams;
  const level = one(sp.level) as Level | undefined;
  const kind = one(sp.kind) as WorkoutKind | undefined;
  const status = one(sp.status) as WorkoutStatus | undefined;
  const search = one(sp.q)?.slice(0, 60);
  const { supabase } = await requireAdmin();
  const filter = {
    level: level && level in LEVEL_LABEL ? level : undefined,
    kind: kind && ["free", "starter", "regular"].includes(kind) ? kind : undefined,
    status: status && ["draft", "scheduled", "published"].includes(status) ? status : undefined,
    search,
  };
  const [workouts, starters] = await Promise.all([
    listAdminWorkouts(supabase, filter),
    listAdminWorkouts(supabase, { kind: "starter" }),
  ]);
  starters.sort((a, b) => (a.starterOrder ?? 0) - (b.starterOrder ?? 0));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Тренировки</h1>
        <Link href="/admin/workouts/new" className={buttonClass("primary", "md")}>Нова</Link>
      </header>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={search} placeholder="Търси по заглавие" className={inputClass + " max-w-xs"} />
        <select name="level" defaultValue={filter.level ?? ""} className={inputClass + " max-w-[10rem]"}>
          <option value="">Всички нива</option>
          {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="status" defaultValue={filter.status ?? ""} className={inputClass + " max-w-[10rem]"}>
          <option value="">Всички статуси</option>
          <option value="draft">Чернови</option>
          <option value="scheduled">Планирани</option>
          <option value="published">Публикувани</option>
        </select>
        <button className={buttonClass("quiet", "md")}>Филтрирай</button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Заглавие</th><th className="p-3">Ниво</th><th className="p-3">Статус</th>
              <th className="p-3">Публикуване</th><th className="p-3">Мин</th><th className="p-3">Завършвания</th>
            </tr>
          </thead>
          <tbody>
            {workouts.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="p-3"><Link href={`/admin/workouts/${w.id}`} className="font-semibold underline-offset-4 hover:underline">{w.title}</Link></td>
                <td className="p-3"><LevelBadge level={w.level} /></td>
                <td className="p-3"><StatusBadge status={w.status} /></td>
                <td className="p-3 tabular-nums">{w.publishAt ? `${utcToZoned(w.publishAt).date} ${utcToZoned(w.publishAt).time}` : "—"}</td>
                <td className="p-3 tabular-nums">{w.durationMin}</td>
                <td className="p-3 tabular-nums">{w.completions}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {workouts.length === 0 && <p className="p-4 text-ink-soft">Няма тренировки с тези филтри.</p>}
      </div>
      {starters.length > 0 && <StarterOrder starters={starters} />}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

`pnpm typecheck && pnpm lint && pnpm test:db && pnpm build` → all 0. Browser (as an aal2 admin, desktop and 375px): create a workout with `youtu.be/…` (no scheme) → saved and listed as „Чернова"; set date+time → „Планирана"; preview opens the player; „Скрий" → draft; delete an unused one; try deleting the free workout (completed in seed tests? if it has no completions locally, complete it once as a client first) → refusal message; reorder the starter week and reload → order kept. Check `/admin/audit` is not built yet — instead confirm `audit_log` rows via SQL in the container. Reset viewport, `preview_stop`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(admin): workouts list, create/edit, schedule, hide, safe delete, starter order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Calendar — month/week view, drag to move, bulk add with auto-distribution

**Files:**
- Create: `src/app/admin/(panel)/calendar/page.tsx`, `src/app/admin/(panel)/calendar/month-view.tsx`, `src/app/admin/(panel)/calendar/bulk-add.tsx`, `src/app/admin/(panel)/calendar/actions.ts`, `src/server/admin/bulk.ts`, `src/server/admin/bulk.test.ts`

**Interfaces:**
- Consumes: `listAdminWorkouts`, `moveWorkoutToDate`, `createAdminWorkout`, `fetchVideoMeta`, `copyThumbnail`, `parseVideoUrl`, `normalizeVideoInput`, `monthGrid`, `weekOf`, `levelGaps`, `utcToZoned`, `zonedToUtc`, `distributeDates`, `ADMIN_TZ`, `requireAdmin`.
- Produces:
  - `interface LinkPreview { line: number; input: string; ok: boolean; error?: string; videoUrl?: string; provider?: VideoProvider; title?: string; durationMin?: number; thumbnailSourceUrl?: string | null }`
  - `previewLinks(text: string, fetchMeta?: (ref: VideoRef) => Promise<VideoMeta>): Promise<LinkPreview[]>` (max 30 lines; blank lines skipped; duplicates flagged)
  - `bulkRowSchema` / `BulkRow { videoUrl; title; level; durationMin; date; time; notify; thumbnailSourceUrl: string | null }`
  - `saveBulk(db, userId, rows: unknown, copy?: typeof copyThumbnail): Promise<{ created: number; errors: { index: number; message: string }[] }>`
  - Actions `previewLinksAction(text)`, `saveBulkAction(rows)`, `moveWorkoutAction(id, date)`

- [ ] **Step 1: Write the failing unit test**

`src/server/admin/bulk.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { previewLinks } from "./bulk";

const meta = vi.fn(async () => ({ title: "От YouTube", durationMin: null, thumbnailSourceUrl: "https://i.ytimg.com/vi/x/hq.jpg" }));

describe("previewLinks", () => {
  it("parses good lines, reports bad and duplicate ones, skips blanks", async () => {
    const text = [
      "https://youtu.be/ml6cT4AZdqI",
      "",
      "youtu.be/ml6cT4AZdqA",
      "https://example.com/video",
      "https://www.youtube.com/watch?v=ml6cT4AZdqI",
      "   ",
    ].join("\n");
    const rows = await previewLinks(text, meta);
    expect(rows.map((r) => [r.line, r.ok, r.error ?? null])).toEqual([
      [1, true, null],
      [3, true, null],
      [4, false, "Не е видео линк (YouTube, Vimeo, Bunny)."],
      [5, false, "Повтаря ред 1."],
    ]);
    expect(rows[1]).toMatchObject({ videoUrl: "https://youtu.be/ml6cT4AZdqA", title: "От YouTube", durationMin: 30 });
  });

  it("caps the number of lines", async () => {
    const text = Array.from({ length: 40 }, (_, i) => `https://youtu.be/ml6cT4AZd${String(i).padStart(2, "0")}`).join("\n");
    const rows = await previewLinks(text, meta);
    expect(rows).toHaveLength(31);
    expect(rows.at(-1)).toMatchObject({ ok: false, error: "Наведнъж до 30 линка." });
  });
});
```

Run: `pnpm test src/server/admin/bulk.test.ts` → FAIL.

- [ ] **Step 2: Implement bulk helpers**

`src/server/admin/bulk.ts`:

```ts
import { z } from "zod";
import { zonedToUtc } from "@/lib/admin/time";
import { actionFail } from "@/lib/action-result";
import { normalizeVideoInput, parseVideoUrl, type VideoProvider, type VideoRef } from "@/lib/video/parse-video-url";
import type { TypedClient } from "@/server/db/types";
import { copyThumbnail } from "./thumbnails";
import { fetchVideoMeta, type VideoMeta } from "./video-meta";
import { createAdminWorkout } from "./workouts";

const MAX_LINES = 30;
const DEFAULT_MINUTES = 30;

export interface LinkPreview {
  line: number;
  input: string;
  ok: boolean;
  error?: string;
  videoUrl?: string;
  provider?: VideoProvider;
  title?: string;
  durationMin?: number;
  thumbnailSourceUrl?: string | null;
}

export async function previewLinks(
  text: string,
  fetchMeta: (ref: VideoRef) => Promise<VideoMeta> = (ref) => fetchVideoMeta(ref),
): Promise<LinkPreview[]> {
  const lines = text.split(/\r?\n/).map((input, i) => ({ input: input.trim(), line: i + 1 })).filter((l) => l.input);
  const seen = new Map<string, number>();
  const out: LinkPreview[] = [];
  for (const { input, line } of lines) {
    if (out.length === MAX_LINES) {
      out.push({ line, input, ok: false, error: `Наведнъж до ${MAX_LINES} линка.` });
      break;
    }
    const ref = parseVideoUrl(input);
    if (!ref) {
      out.push({ line, input, ok: false, error: "Не е видео линк (YouTube, Vimeo, Bunny)." });
      continue;
    }
    const key = `${ref.provider}:${ref.id}`;
    const first = seen.get(key);
    if (first !== undefined) {
      out.push({ line, input, ok: false, error: `Повтаря ред ${first}.` });
      continue;
    }
    seen.set(key, line);
    const meta = await fetchMeta(ref);
    out.push({
      line,
      input,
      ok: true,
      videoUrl: normalizeVideoInput(input),
      provider: ref.provider,
      title: meta.title ?? `Тренировка ${out.length + 1}`,
      durationMin: meta.durationMin ?? DEFAULT_MINUTES,
      thumbnailSourceUrl: meta.thumbnailSourceUrl,
    });
  }
  return out;
}

export const bulkRowSchema = z.object({
  videoUrl: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  level: z.enum(["beginner", "advanced", "pro"]),
  durationMin: z.number().int().min(1).max(180),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Избери дата"),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notify: z.boolean(),
  thumbnailSourceUrl: z.string().nullable(),
});
export type BulkRow = z.infer<typeof bulkRowSchema>;

/** Creates every valid row; a failing row is reported and does not stop the others. */
export async function saveBulk(
  db: TypedClient,
  userId: string,
  raw: unknown,
  copy: typeof copyThumbnail = copyThumbnail,
): Promise<{ created: number; errors: { index: number; message: string }[] }> {
  const rows = z.array(z.unknown()).max(MAX_LINES).parse(raw);
  let created = 0;
  const errors: { index: number; message: string }[] = [];
  for (const [index, item] of rows.entries()) {
    try {
      const row = bulkRowSchema.parse(item);
      const thumbnailUrl = row.thumbnailSourceUrl ? await copy(db, row.thumbnailSourceUrl) : null;
      await createAdminWorkout(db, userId, {
        title: row.title,
        description: "",
        kind: "regular",
        level: row.level,
        durationMin: row.durationMin,
        focus: [],
        videoUrl: row.videoUrl,
        thumbnailUrl,
        publishAt: zonedToUtc(row.date, row.time),
        notify: row.notify,
      });
      created++;
    } catch (error) {
      errors.push({ index, message: actionFail(error).message });
    }
  }
  return { created, errors };
}
```

Add a DB test to `supabase/tests/admin-workouts.test.ts`:

```ts
import { saveBulk } from "@/server/admin/bulk";

describe("saveBulk", () => {
  it("creates valid rows and reports invalid ones", async () => {
    const row = { videoUrl: "https://youtu.be/ml6cT4AZdqI", title: "Bulk 1", level: "beginner", durationMin: 20, date: "2031-11-04", time: "07:00", notify: true, thumbnailSourceUrl: null };
    const result = await saveBulk(boss, bossId, [row, { ...row, title: "", date: "x" }, { ...row, title: "Bulk 3", videoUrl: "https://example.com" }], async () => null);
    expect(result.created).toBe(1);
    expect(result.errors.map((e) => e.index)).toEqual([1, 2]);
    const { data } = await admin.from("workouts").select("publish_at").eq("title", "Bulk 1").order("created_at", { ascending: false }).limit(1).single();
    expect(Date.parse(data!.publish_at!)).toBe(Date.parse("2031-11-04T05:00:00Z"));
  });
});
```

Run: `pnpm test src/server/admin/bulk.test.ts && pnpm test:db supabase/tests/admin-workouts.test.ts` → PASS.

- [ ] **Step 3: Actions**

`src/app/admin/(panel)/calendar/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { previewLinks, saveBulk, type LinkPreview } from "@/server/admin/bulk";
import { requireAdmin } from "@/server/admin/require-admin";
import { moveWorkoutToDate } from "@/server/admin/workouts";

export async function previewLinksAction(text: string): Promise<ActionResult<LinkPreview[]>> {
  try {
    await requireAdmin();
    return actionOk(await previewLinks(z.string().max(20_000).parse(text)));
  } catch (error) {
    return actionFail(error);
  }
}

export async function saveBulkAction(rows: unknown): Promise<ActionResult<{ created: number; errors: { index: number; message: string }[] }>> {
  try {
    const { user, supabase } = await requireAdmin();
    const result = await saveBulk(supabase, user.id, rows);
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/workouts");
    return actionOk(result);
  } catch (error) {
    return actionFail(error);
  }
}

export async function moveWorkoutAction(id: string, date: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await moveWorkoutToDate(supabase, z.uuid().parse(id), date);
    revalidatePath("/admin/calendar");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
```

- [ ] **Step 4: Calendar UI**

`src/app/admin/(panel)/calendar/month-view.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { AdminWorkout } from "@/server/admin/workouts";
import { moveWorkoutAction } from "./actions";

const TONE = { beginner: "border-moss", advanced: "border-mustard", pro: "border-brick" } as const;

export function MonthView({
  weeks,
  month,
  today,
  byDate,
}: {
  weeks: string[][];
  month: string; // YYYY-MM
  today: string;
  byDate: Record<string, (AdminWorkout & { localTime: string })[]>;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function drop(date: string, id: string) {
    startTransition(async () => {
      const r = await moveWorkoutAction(id, date);
      setMessage(r.ok ? `Преместена за ${date} ✓` : r.message);
    });
  }

  return (
    <div className="space-y-2">
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-soft">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className={cn("grid grid-cols-7 gap-1", pending && "opacity-60")}>
        {weeks.flat().map((date) => (
          <div
            key={date}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(date, e.dataTransfer.getData("text/plain"))}
            className={cn(
              "min-h-24 rounded-xl bg-white p-1 ring-1 ring-line",
              !date.startsWith(month) && "opacity-50",
              date === today && "ring-2 ring-ink",
            )}
          >
            <p className="text-right text-xs tabular-nums text-ink-soft">{Number(date.slice(8))}</p>
            <ul className="space-y-1">
              {(byDate[date] ?? []).map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/admin/workouts/${w.id}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", w.id)}
                    className={cn(
                      "block truncate rounded-lg border-l-4 bg-paper px-1 py-0.5 text-left text-[11px]",
                      w.level ? TONE[w.level] : "border-ember",
                      w.status === "draft" && "opacity-60",
                    )}
                    title={`${w.localTime} · ${w.title}`}
                  >
                    {w.localTime} {w.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-soft">Плъзни тренировка върху друг ден, за да я преместиш (часът се запазва).</p>
    </div>
  );
}
```

`src/app/admin/(panel)/calendar/bulk-add.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { distributeDates } from "@/lib/admin/schedule";
import { utcToZoned } from "@/lib/admin/time";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level } from "@/lib/program/types";
import type { BulkRow, LinkPreview } from "@/server/admin/bulk";
import { previewLinksAction, saveBulkAction } from "./actions";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export function BulkAdd({ today }: { today: string }) {
  const [text, setText] = useState("");
  const [previews, setPreviews] = useState<LinkPreview[]>([]);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [level, setLevel] = useState<Level>("beginner");
  const [start, setStart] = useState(today);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("07:00");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function preview() {
    startTransition(async () => {
      const r = await previewLinksAction(text);
      if (!r.ok) return setMessage(r.message);
      setPreviews(r.data);
      setRows(
        r.data.filter((p) => p.ok).map((p) => ({
          videoUrl: p.videoUrl!,
          title: p.title!,
          level,
          durationMin: p.durationMin!,
          date: "",
          time,
          notify: true,
          thumbnailSourceUrl: p.thumbnailSourceUrl ?? null,
        })),
      );
      setMessage("");
    });
  }

  function distribute() {
    const dates = distributeDates({ startDate: start, weekdays: days, time, count: rows.length });
    setRows(rows.map((row, i) => ({ ...row, level, time, ...(dates[i] ? { date: utcToZoned(dates[i]!).date } : {}) })));
  }

  function update(i: number, patch: Partial<BulkRow>) {
    setRows(rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function save() {
    startTransition(async () => {
      const r = await saveBulkAction(rows);
      if (!r.ok) return setMessage(r.message);
      const failed = r.data.errors.map((e) => `ред ${e.index + 1}: ${e.message}`).join("; ");
      setMessage(`Създадени: ${r.data.created}.${failed ? ` Грешки — ${failed}` : ""}`);
      if (r.data.errors.length === 0) {
        setText("");
        setPreviews([]);
        setRows([]);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="font-semibold">Добави няколко</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"Постави линкове, по един на ред\nhttps://youtu.be/…"}
        className={inputClass + " h-auto py-3"}
      />
      <Button size="md" disabled={pending || !text.trim()} onClick={preview}>Провери линковете</Button>

      {previews.some((p) => !p.ok) && (
        <ul className="space-y-1 text-sm text-brick">
          {previews.filter((p) => !p.ok).map((p) => <li key={p.line}>Ред {p.line}: {p.error}</li>)}
        </ul>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-paper p-3 text-sm">
            <label className="space-y-1">
              <span className="block font-semibold">Ниво за всички</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className={inputClass + " h-11"}>
                {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block font-semibold">От дата</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass + " h-11"} />
            </label>
            <fieldset className="space-y-1">
              <legend className="font-semibold">Дни</legend>
              <div className="flex gap-1">
                {WEEKDAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1">
                    <input type="checkbox" checked={days.includes(i)} onChange={(e) => setDays(e.target.checked ? [...days, i] : days.filter((x) => x !== i))} />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="space-y-1">
              <span className="block font-semibold">Час</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass + " h-11"} />
            </label>
            <Button variant="quiet" size="md" onClick={distribute}>Разпредели автоматично</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-ink-soft">
                <tr><th className="p-2">Заглавие</th><th className="p-2">Ниво</th><th className="p-2">Мин</th><th className="p-2">Дата</th><th className="p-2">Час</th><th className="p-2">Известие</th></tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.videoUrl} className="border-t border-line">
                    <td className="p-2"><input value={row.title} onChange={(e) => update(i, { title: e.target.value })} className={inputClass + " h-10"} /></td>
                    <td className="p-2">
                      <select value={row.level} onChange={(e) => update(i, { level: e.target.value as Level })} className={inputClass + " h-10"}>
                        {Object.entries(LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><input type="number" min={1} max={180} value={row.durationMin} onChange={(e) => update(i, { durationMin: Number(e.target.value) })} className={inputClass + " h-10 w-20"} /></td>
                    <td className="p-2"><input type="date" value={row.date} onChange={(e) => update(i, { date: e.target.value })} className={inputClass + " h-10"} /></td>
                    <td className="p-2"><input type="time" value={row.time} onChange={(e) => update(i, { time: e.target.value })} className={inputClass + " h-10"} /></td>
                    <td className="p-2 text-center"><input type="checkbox" checked={row.notify} onChange={(e) => update(i, { notify: e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="md" disabled={pending || rows.some((r) => !r.date)} onClick={save}>
            Запази {rows.length} тренировки
          </Button>
        </>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}
```

`src/app/admin/(panel)/calendar/page.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { levelGaps, monthGrid, weekOf } from "@/lib/admin/calendar";
import { utcToZoned } from "@/lib/admin/time";
import { LEVEL_LABEL } from "@/lib/labels";
import { requireAdmin } from "@/server/admin/require-admin";
import { listAdminWorkouts } from "@/server/admin/workouts";
import { BulkAdd } from "./bulk-add";
import { MonthView } from "./month-view";

export const metadata = { title: "Календар" };
type Search = Promise<{ m?: string; view?: string; d?: string }>;

export default function CalendarPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

async function Calendar({ searchParams }: { searchParams: Search }) {
  await connection();
  const sp = await searchParams;
  const now = new Date();
  const today = utcToZoned(now.toISOString()).date;
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const week = sp.view === "week";
  const anchor = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const [y, m] = month.split("-").map(Number);
  const weeks = week ? [weekOf(anchor)] : monthGrid(y!, m!);

  const { supabase } = await requireAdmin();
  const workouts = await listAdminWorkouts(supabase, {}, now);
  const byDate: Record<string, (typeof workouts[number] & { localTime: string })[]> = {};
  for (const w of workouts) {
    if (!w.publishAt) continue;
    const local = utcToZoned(w.publishAt);
    (byDate[local.date] ??= []).push({ ...w, localTime: local.time });
  }
  for (const list of Object.values(byDate)) list.sort((a, b) => a.localTime.localeCompare(b.localTime));
  const gaps = levelGaps(workouts, now, 7);
  const drafts = workouts.filter((w) => w.status === "draft" && w.kind === "regular");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-2xl font-bold">Календар</h1>
        <Link href={`?m=${shiftMonth(month, -1)}`} className={buttonClass("quiet", "md")}>←</Link>
        <span className="font-semibold tabular-nums">{month}</span>
        <Link href={`?m=${shiftMonth(month, 1)}`} className={buttonClass("quiet", "md")}>→</Link>
        <Link href={week ? `?m=${month}` : `?view=week&d=${today}`} className={buttonClass("ghost", "md")}>
          {week ? "Месец" : "Седмица"}
        </Link>
      </header>

      {gaps.length > 0 && (
        <ul className="space-y-1 rounded-2xl bg-mustard/15 p-4 text-sm">
          {gaps.map((g) => (
            <li key={g.level}>
              ⚠ Ниво „{LEVEL_LABEL[g.level]}" {g.lastAt ? `няма планирано съдържание след ${utcToZoned(g.lastAt).date}` : "няма нито една тренировка"}.
            </li>
          ))}
        </ul>
      )}

      <MonthView weeks={weeks} month={month} today={today} byDate={byDate} />

      {drafts.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Чернови без дата</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {drafts.map((w) => (
              <li key={w.id}><Link href={`/admin/workouts/${w.id}`} className="rounded-full bg-ink/5 px-3 py-1">{w.title}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <BulkAdd today={today} />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

`pnpm typecheck && pnpm lint && pnpm test && pnpm build` → 0. Browser as aal2 admin (desktop 1280px and 375px): paste 5 lines (2 valid YouTube with and without `https://`, one duplicate, one junk, one blank) → per-line errors for duplicate/junk, 2 rows in the table with titles from oEmbed (network permitting; otherwise „Тренировка N"); choose level, Tue/Thu/Sat 07:00 → „Разпредели" fills dates; save → „Създадени: 2"; cards appear on those days; drag a card to another day → moved, same time; level-gap warning appears when a level has nothing in the next 7 days; month arrows and week view work. No console errors. Reset viewport, `preview_stop`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(admin): calendar with drag-to-move, level gap warnings and bulk link scheduling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Clients — list, detail, notes, manual access

**Files:**
- Create: `src/server/admin/clients.ts`, `src/server/admin/notes.ts`, `supabase/tests/admin-clients.test.ts`, `src/app/admin/(panel)/clients/page.tsx`, `src/app/admin/(panel)/clients/[id]/page.tsx`, `src/app/admin/(panel)/clients/[id]/actions.ts`

**Interfaces:**
- Consumes: `admin_client_stats` RPC, `client_notes`, `requireAdmin`, `ActionForm`, `LevelBadge`, `Sparkline`, `subscriptionText`, labels, form-data helpers.
- Produces:
  - `interface ClientRow { userId; name; email; phone: string | null; phoneCallConsent: boolean; level: Level; joinedAt: string; lastSeenAt: string | null; onboardingDone: boolean; subStatus: string | null; subProvider: string | null; currentPeriodEnd: string | null; hasAccess: boolean; totalDone: number; lastDoneAt: string | null; done7: number; done30: number; minutes7: number; minutes30: number; published14: number; doneRegular14: number; paidWithoutWorkout: boolean; snoozedUntil: string | null }`
  - `listClients(db, opts?: { search?: string; limit?: number; offset?: number }): Promise<{ rows: ClientRow[]; total: number }>`
  - `getClientDetail(db, userId): Promise<ClientDetail | null>` (profile, subscription, completions with workout title, check-ins, notes with author name)
  - `grantManualAccess(db, userId, days: number): Promise<void>` (CONFLICT over paid); `revokeManualAccess(db, userId): Promise<void>`
  - `noteInputSchema`; `addNote(db, userId, raw): Promise<void>` (kinds note/call/snooze); `recordMessage(db, userId, body): Promise<void>`

- [ ] **Step 1: Write the failing DB tests**

`supabase/tests/admin-clients.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { getClientDetail, grantManualAccess, listClients, revokeManualAccess } from "@/server/admin/clients";
import { addNote } from "@/server/admin/notes";
import { adminClient, createAdminUser, createUser, type TypedClient } from "./helpers";

let admin: TypedClient;
let boss: TypedClient;

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "cl-admin")).db;
});

async function access(userId: string) {
  const { data } = await admin.rpc("has_active_access", { uid: userId });
  return data === true;
}

describe("clients service", () => {
  it("lists and finds a client by email", async () => {
    const user = await createUser(admin, "cl-find", { name: "Яна" });
    const { rows, total } = await listClients(boss, { search: user.email });
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ userId: user.id, name: "Яна", hasAccess: false, totalDone: 0 });
  });

  it("grants manual access for N days and revokes it", async () => {
    const user = await createUser(admin, "cl-grant");
    await grantManualAccess(boss, user.id, 14);
    expect(await access(user.id)).toBe(true);
    const { data } = await admin.from("subscriptions").select("provider, current_period_end").eq("user_id", user.id).single();
    expect(data?.provider).toBe("manual");
    expect(Date.parse(data!.current_period_end!) - Date.now()).toBeGreaterThan(13 * 86_400_000);
    await revokeManualAccess(boss, user.id);
    expect(await access(user.id)).toBe(false);
  });

  it("refuses manual access over a paid subscription", async () => {
    const user = await createUser(admin, "cl-paid");
    await admin.from("subscriptions").insert({ user_id: user.id, provider: "stripe", status: "active" });
    await expect(grantManualAccess(boss, user.id, 7)).rejects.toMatchObject({ code: "CONFLICT" });
    const { data } = await admin.from("subscriptions").select("provider").eq("user_id", user.id).single();
    expect(data?.provider).toBe("stripe");
  });

  it("rejects absurd day counts", async () => {
    const user = await createUser(admin, "cl-days");
    await expect(grantManualAccess(boss, user.id, 0)).rejects.toThrow();
    await expect(grantManualAccess(boss, user.id, 9999)).rejects.toThrow();
  });

  it("adds notes and a snooze, and shows them in the detail with the author", async () => {
    const user = await createUser(admin, "cl-notes");
    await addNote(boss, user.id, { kind: "note", body: "Болки в коляното — мина на Начинаещ." });
    await addNote(boss, user.id, { kind: "snooze", days: 7 });
    const detail = await getClientDetail(boss, user.id);
    expect(detail?.notes.map((n) => n.kind)).toEqual(["snooze", "note"]);
    expect(detail?.notes[1]?.authorName).toBeDefined();
    const { rows } = await listClients(boss, { search: user.email });
    expect(rows[0]?.snoozedUntil).not.toBeNull();
  });

  it("returns null for an unknown client", async () => {
    expect(await getClientDetail(boss, crypto.randomUUID())).toBeNull();
  });
});
```

Run: `pnpm test:db supabase/tests/admin-clients.test.ts` → FAIL.

- [ ] **Step 2: Implement the services**

`src/server/admin/clients.ts`:

```ts
import { z } from "zod";
import { AppError } from "@/lib/app-error";
import type { Level } from "@/lib/program/types";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

type StatsRow = Database["public"]["Functions"]["admin_client_stats"]["Returns"][number];

export interface ClientRow {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  phoneCallConsent: boolean;
  level: Level;
  joinedAt: string;
  lastSeenAt: string | null;
  onboardingDone: boolean;
  subStatus: string | null;
  subProvider: string | null;
  currentPeriodEnd: string | null;
  hasAccess: boolean;
  totalDone: number;
  lastDoneAt: string | null;
  done7: number;
  done30: number;
  minutes7: number;
  minutes30: number;
  published14: number;
  doneRegular14: number;
  paidWithoutWorkout: boolean;
  snoozedUntil: string | null;
}

export function toClientRow(r: StatsRow): ClientRow {
  return {
    userId: r.user_id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? null,
    phoneCallConsent: r.phone_call_consent,
    level: r.level,
    joinedAt: r.joined_at,
    lastSeenAt: r.last_seen_at ?? null,
    onboardingDone: r.onboarding_done,
    subStatus: r.sub_status ?? null,
    subProvider: r.sub_provider ?? null,
    currentPeriodEnd: r.current_period_end ?? null,
    hasAccess: r.has_access,
    totalDone: r.total_done,
    lastDoneAt: r.last_done_at ?? null,
    done7: r.done_7,
    done30: r.done_30,
    minutes7: r.minutes_7,
    minutes30: r.minutes_30,
    published14: r.published_14,
    doneRegular14: r.done_regular_14,
    paidWithoutWorkout: r.paid_without_workout,
    snoozedUntil: r.snoozed_until ?? null,
  };
}

export async function listClients(
  db: TypedClient,
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<{ rows: ClientRow[]; total: number }> {
  const { data, error } = await db.rpc("admin_client_stats", {
    p_search: opts.search?.trim() || undefined,
    p_limit: opts.limit ?? 200,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw new Error(`list clients failed: ${error.message}`);
  return { rows: data.map(toClientRow), total: Number(data[0]?.total_count ?? 0) };
}

export async function getClientDetail(db: TypedClient, userId: string) {
  const [profile, subscription, completions, checkIns, notes] = await Promise.all([
    db
      .from("profiles")
      .select("id, name, email, phone, phone_call_consent, marketing_consent, health_data_consent_at, level, goal, problems, height_cm, weight_kg, target_weight_kg, time_per_session, joined_at, last_seen_at, timezone, starter_week_done_at, role")
      .eq("id", userId)
      .maybeSingle(),
    db.from("subscriptions").select("status, provider, current_period_end, grace_until, canceled_at").eq("user_id", userId).maybeSingle(),
    db
      .from("workout_completions")
      .select("id, completed_at, local_date, feeling, workouts(title, kind, level, duration_min)")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(60),
    db
      .from("check_ins")
      .select("created_at, weight_kg, waist_cm, hips_cm, energy, mood, note")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("client_notes")
      .select("id, kind, body, snooze_until, created_at, author:profiles!client_notes_author_id_fkey(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const failed = [profile, subscription, completions, checkIns, notes].find((r) => r.error);
  if (failed?.error) throw new Error(`load client failed: ${failed.error.message}`);
  if (!profile.data || profile.data.role !== "client") return null;
  return {
    profile: profile.data,
    subscription: subscription.data,
    completions: completions.data ?? [],
    checkIns: [...(checkIns.data ?? [])].reverse(),
    notes: (notes.data ?? []).map((n) => {
      const author = n.author as { name: string } | { name: string }[] | null;
      return { ...n, authorName: (Array.isArray(author) ? author[0]?.name : author?.name) ?? "—" };
    }),
  };
}
export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClientDetail>>>;

const daysSchema = z.number().int().min(1, "Поне 1 ден").max(365, "До 365 дни");

export async function grantManualAccess(db: TypedClient, userId: string, days: number): Promise<void> {
  const d = daysSchema.parse(days);
  const { data: existing, error: loadError } = await db.from("subscriptions").select("provider").eq("user_id", userId).maybeSingle();
  if (loadError) throw new Error(`load subscription failed: ${loadError.message}`);
  if (existing && existing.provider !== "manual") throw new AppError("CONFLICT", "Клиентката има платен абонамент.");
  const { error } = await db.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: "manual",
      status: "active",
      current_period_end: new Date(Date.now() + d * 86_400_000).toISOString(),
      grace_until: null,
      canceled_at: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`grant access failed: ${error.message}`);
}

export async function revokeManualAccess(db: TypedClient, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("subscriptions")
    .update({ status: "canceled", current_period_end: now, canceled_at: now })
    .eq("user_id", userId)
    .eq("provider", "manual")
    .select("user_id");
  if (error) throw new Error(`revoke access failed: ${error.message}`);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Няма ръчен достъп за спиране.");
}
```

`src/server/admin/notes.ts`:

```ts
import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

export const noteInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("note"), body: z.string().trim().min(1, "Напиши бележка").max(2000) }),
  z.object({ kind: z.literal("call"), body: z.string().trim().max(2000).default("") }),
  z.object({ kind: z.literal("snooze"), days: z.number().int().min(1).max(60) }),
]);

export async function addNote(db: TypedClient, userId: string, raw: unknown): Promise<void> {
  const note = noteInputSchema.parse(raw);
  const row =
    note.kind === "snooze"
      ? { user_id: userId, kind: note.kind, body: `Отложено с ${note.days} дни`, snooze_until: new Date(Date.now() + note.days * 86_400_000).toISOString() }
      : { user_id: userId, kind: note.kind, body: note.body };
  const { error } = await db.from("client_notes").insert(row);
  if (error) throw new Error(`add note failed: ${error.message}`);
}

export async function recordMessage(db: TypedClient, userId: string, body: string): Promise<void> {
  const { error } = await db.from("client_notes").insert({ user_id: userId, kind: "message", body: body.slice(0, 2000) });
  if (error) throw new Error(`record message failed: ${error.message}`);
}
```

Run: `pnpm test:db supabase/tests/admin-clients.test.ts` → PASS.

- [ ] **Step 3: Actions and pages**

`src/app/admin/(panel)/clients/[id]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formInt, formString } from "@/lib/form-data";
import { grantManualAccess, revokeManualAccess } from "@/server/admin/clients";
import { addNote } from "@/server/admin/notes";
import { requireAdmin } from "@/server/admin/require-admin";

export async function addNoteAction(userId: string, _prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const kind = formString(form, "kind");
    await addNote(supabase, userId, kind === "snooze" ? { kind, days: formInt(form, "days") } : { kind, body: formString(form, "body") });
    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath("/admin/at-risk");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function grantAccessAction(userId: string, _prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await grantManualAccess(supabase, userId, formInt(form, "days"));
    revalidatePath(`/admin/clients/${userId}`);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function revokeAccessAction(userId: string, _prev: unknown): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await revokeManualAccess(supabase, userId);
    revalidatePath(`/admin/clients/${userId}`);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
```

`src/app/admin/(panel)/clients/page.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import { listClients } from "@/server/admin/clients";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Клиентки" };
type Search = Promise<{ q?: string; page?: string }>;
const PAGE = 50;
const date = (iso: string | null) => (iso ? utcToZoned(iso).date : "—");

export default function ClientsPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Clients searchParams={searchParams} />
    </Suspense>
  );
}

async function Clients({ searchParams }: { searchParams: Search }) {
  await connection();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase } = await requireAdmin();
  const { rows, total } = await listClients(supabase, { search: q, limit: PAGE, offset: (page - 1) * PAGE });
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Клиентки <span className="text-ink-soft">({total})</span></h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Име или имейл" className={inputClass + " max-w-xs"} />
        <button className={buttonClass("quiet", "md")}>Търси</button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Име</th><th className="p-3">Ниво</th><th className="p-3">Абонамент</th><th className="p-3">Регистрация</th>
              <th className="p-3">Последно влизане</th><th className="p-3">Последна тренировка</th><th className="p-3">Тренировки</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.userId} className="border-t border-line">
                <td className="p-3">
                  <Link href={`/admin/clients/${c.userId}`} className="font-semibold hover:underline">{c.name || "—"}</Link>
                  <p className="text-xs text-ink-soft">{c.email}</p>
                </td>
                <td className="p-3"><LevelBadge level={c.level} /></td>
                <td className="p-3">{c.hasAccess ? (c.subProvider === "manual" ? "Ръчен" : "Активен") : c.subStatus === "past_due" ? "Просрочен" : "—"}</td>
                <td className="p-3 tabular-nums">{date(c.joinedAt)}</td>
                <td className="p-3 tabular-nums">{date(c.lastSeenAt)}</td>
                <td className="p-3 tabular-nums">{date(c.lastDoneAt)}</td>
                <td className="p-3 tabular-nums">{c.totalDone}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-ink-soft">Няма клиентки.</p>}
      </div>
      {pages > 1 && (
        <nav className="flex gap-2">
          {page > 1 && <Link href={link(page - 1)} className={buttonClass("quiet", "md")}>← Предишна</Link>}
          <span className="self-center text-sm">{page} / {pages}</span>
          {page < pages && <Link href={link(page + 1)} className={buttonClass("quiet", "md")}>Следваща →</Link>}
        </nav>
      )}
    </div>
  );
}
```

`src/app/admin/(panel)/clients/[id]/page.tsx`:

```tsx
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { LevelBadge } from "@/components/admin/level-badge";
import { Sparkline } from "@/components/progress/sparkline";
import { Field, inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import { FEELING_LABEL, GOAL_LABEL, PROBLEM_LABEL, TIME_LABEL, type Goal, type Problem, type Time } from "@/lib/labels";
import { getClientDetail } from "@/server/admin/clients";
import { requireAdmin } from "@/server/admin/require-admin";
import { addNoteAction, grantAccessAction, revokeAccessAction } from "./actions";

export const metadata = { title: "Клиентка" };
const when = (iso: string | null | undefined) => (iso ? `${utcToZoned(iso).date} ${utcToZoned(iso).time}` : "—");
const NOTE_LABEL = { call: "Обаждане", message: "Съобщение", note: "Бележка", snooze: "Отложено" } as const;

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Client params={params} />
    </Suspense>
  );
}

async function Client({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const c = /^[0-9a-f-]{36}$/i.test(id) ? await getClientDetail(supabase, id) : null;
  if (!c) notFound();
  const p = c.profile;
  const weights = c.checkIns.map((x) => x.weight_kg).filter((w): w is number => w !== null);
  const manual = c.subscription?.provider === "manual";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">{p.name || p.email}</h1>
        <LevelBadge level={p.level} />
        {p.phone && p.phone_call_consent ? (
          <a href={`tel:${p.phone}`} className="rounded-full bg-moss px-3 py-1 text-sm font-semibold text-white">📞 {p.phone}</a>
        ) : (
          <span className="text-sm text-ink-soft">Без съгласие за обаждане</span>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          <h2 className="font-semibold">Анкета</h2>
          <p>Цел: {p.goal ? GOAL_LABEL[p.goal as Goal] : "—"}</p>
          <p>Проблеми: {p.problems.map((x) => PROBLEM_LABEL[x as Problem] ?? x).join(", ") || "—"}</p>
          <p>Ръст {p.height_cm ?? "—"} см · тегло {p.weight_kg ?? "—"} кг · цел {p.target_weight_kg ?? "—"} кг</p>
          <p>Време: {p.time_per_session ? TIME_LABEL[p.time_per_session as Time] : "—"}</p>
          <p className="text-ink-soft">Имейл {p.email} · регистрация {when(p.joined_at)} · последно {when(p.last_seen_at)}</p>
          <p className="text-ink-soft">Маркетинг: {p.marketing_consent ? "да" : "не"} · здравни данни: {p.health_data_consent_at ? when(p.health_data_consent_at) : "—"}</p>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          <h2 className="font-semibold">Абонамент</h2>
          <p>
            {c.subscription ? `${c.subscription.provider} · ${c.subscription.status}` : "Няма"}
            {c.subscription?.current_period_end ? ` · до ${when(c.subscription.current_period_end)}` : ""}
          </p>
          <ActionForm action={grantAccessAction.bind(null, p.id)} submitLabel="Дай достъп" successMessage="Достъпът е даден ✓" className="flex flex-wrap items-end gap-2">
            <Field label="Ръчен достъп, дни">
              <input name="days" type="number" min={1} max={365} defaultValue={30} className={inputClass + " h-11 w-28"} />
            </Field>
          </ActionForm>
          {manual && c.subscription?.status !== "canceled" && (
            <ActionForm action={revokeAccessAction.bind(null, p.id)} submitLabel="Спри ръчния достъп" successMessage="Спрян ✓">
              <span />
            </ActionForm>
          )}
        </section>
      </div>

      <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-semibold">Тегло</h2>
        <Sparkline points={weights} label="Тегло във времето" />
        <ul className="text-sm text-ink-soft">
          {c.checkIns.slice(-5).reverse().map((x) => (
            <li key={x.created_at}>{when(x.created_at)} · {x.weight_kg ?? "—"} кг · талия {x.waist_cm ?? "—"} · енергия {x.energy ?? "—"}/5{x.note ? ` · „${x.note}"` : ""}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-semibold">Тренировки ({c.completions.length})</h2>
        <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
          {c.completions.map((x) => {
            const w = (Array.isArray(x.workouts) ? x.workouts[0] : x.workouts) as { title: string; duration_min: number } | null;
            return (
              <li key={x.id}>{x.local_date} · {w?.title ?? "—"} · {w?.duration_min ?? "?"} мин{x.feeling ? ` · ${FEELING_LABEL[x.feeling]}` : ""}</li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-semibold">Бележки и контакти</h2>
        <ActionForm action={addNoteAction.bind(null, p.id)} submitLabel="Добави" resetOnSuccess>
          <div className="flex flex-wrap gap-2">
            <select name="kind" defaultValue="note" className={inputClass + " h-11 max-w-[12rem]"}>
              <option value="note">Бележка</option>
              <option value="call">Обаждане</option>
            </select>
            <input name="body" placeholder="Какво се случи?" maxLength={2000} className={inputClass + " h-11 flex-1"} />
          </div>
        </ActionForm>
        <ul className="space-y-2 text-sm">
          {c.notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-paper p-2">
              <span className="font-semibold">{NOTE_LABEL[n.kind]}</span> · {when(n.created_at)} · {n.authorName}
              {n.body && <p className="whitespace-pre-line">{n.body}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

`pnpm typecheck && pnpm lint && pnpm test:db && pnpm build` → 0. Browser as aal2 admin: `/admin/clients` lists clients (no admins), search by email, pagination appears only with > 50; detail shows answers, sparkline, completions, grant 14 days → „Достъпът е даден", client app shows content for that user; revoke; add a note and a call → listed with author; a client whose `phone_call_consent` is false shows no call link. 375px: tables scroll inside their box, page itself does not. `preview_stop`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(admin): clients list and detail with notes and manual access

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Activity and „Изостават" (with message sending)

**Files:**
- Create: `src/server/admin/risk.ts`, `supabase/tests/admin-risk.test.ts`, `src/app/admin/(panel)/activity/page.tsx`, `src/app/admin/(panel)/at-risk/page.tsx`, `src/app/admin/(panel)/at-risk/risk-actions.tsx`, `src/app/admin/(panel)/at-risk/actions.ts`, `src/server/admin/settings.ts` (read part: `getSettings`)

**Interfaces:**
- Consumes: `listClients`, `ClientRow`, `assessRisk`, `RISK_LABEL`, `completionPct`, `parseSetting`, `renderTemplate`, `SETTING_DEFAULTS`, `createMailer`, `serverEnv`, `addNote`, `recordMessage`, `requireAdmin`.
- Produces:
  - `getSettings(db): Promise<Settings>` (all keys, defaults for missing/invalid)
  - `listAtRisk(db, thresholds: RiskThresholds, now?: Date, search?: string): Promise<{ client: ClientRow; reasons: RiskReason[] }[]>` (`search` narrows to matching clients — used by tests for isolation)
  - `sendNudge(db, mailer: Mailer, userId: string, templates: Settings["email_templates"]): Promise<{ delivered: boolean }>` (always records a `message` note)
  - Actions `nudgeAction(userId)`, `snoozeAction(userId)`, `quickNoteAction(userId, prev, form)`

- [ ] **Step 1: Write the failing DB tests**

`supabase/tests/admin-risk.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SETTING_DEFAULTS } from "@/lib/admin/settings";
import { listAtRisk, sendNudge } from "@/server/admin/risk";
import { getSettings } from "@/server/admin/settings";
import { adminClient, createAdminUser, createUser, grantAccess, type TypedClient } from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const thresholds = { inactiveDays: 5, minCompletionPct: 50 };

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "risk-admin")).db;
});

describe("listAtRisk", () => {
  it("lists a subscriber who has not trained, and drops her after a snooze", async () => {
    const user = await createUser(admin, "risk-idle");
    await admin.from("profiles").update({ joined_at: new Date(Date.now() - 10 * 86_400_000).toISOString() }).eq("id", user.id);
    await grantAccess(admin, user.id);
    const found = (await listAtRisk(boss, thresholds, new Date(), user.email)).find((r) => r.client.userId === user.id);
    expect(found?.reasons).toContain("inactive");
    await boss.from("client_notes").insert({ user_id: user.id, kind: "snooze", snooze_until: new Date(Date.now() + 86_400_000).toISOString() });
    expect((await listAtRisk(boss, thresholds, new Date(), user.email)).find((r) => r.client.userId === user.id)).toBeUndefined();
  });

  it("ignores a lead without access", async () => {
    const lead = await createUser(admin, "risk-lead");
    expect((await listAtRisk(boss, thresholds, new Date(), lead.email)).find((r) => r.client.userId === lead.id)).toBeUndefined();
  });
});

describe("sendNudge", () => {
  it("renders the template, sends it and records a message note", async () => {
    const user = await createUser(admin, "risk-nudge", { name: "Деси" });
    const send = vi.fn(async () => ({ delivered: true }));
    const result = await sendNudge(boss, { send }, user.id, { nudgeSubject: "Хей, {{name}}", nudgeBody: "Здравей, {{name}}!" });
    expect(result).toEqual({ delivered: true });
    expect(send).toHaveBeenCalledWith({ to: user.email, toName: "Деси", subject: "Хей, Деси", text: "Здравей, Деси!" });
    const { data } = await admin.from("client_notes").select("kind, body").eq("user_id", user.id);
    expect(data).toEqual([{ kind: "message", body: "Хей, Деси\n\nЗдравей, Деси!" }]);
  });

  it("records an undelivered message honestly", async () => {
    const user = await createUser(admin, "risk-nomail", { name: "Ива" });
    await sendNudge(boss, { send: async () => ({ delivered: false }) }, user.id, SETTING_DEFAULTS.email_templates);
    const { data } = await admin.from("client_notes").select("body").eq("user_id", user.id).single();
    expect(data?.body).toMatch(/^\(НЕ Е ИЗПРАТЕНО/);
  });
});

describe("getSettings", () => {
  it("returns defaults when nothing is stored", async () => {
    await boss.from("settings").delete().eq("key", "risk");
    expect((await getSettings(boss)).risk).toEqual(SETTING_DEFAULTS.risk);
  });
});
```

Run: `pnpm test:db supabase/tests/admin-risk.test.ts` → FAIL.

- [ ] **Step 2: Implement**

`src/server/admin/settings.ts` (read part now; writes added in Task 11):

```ts
import { parseSetting, SETTINGS, type SettingKey, type Settings } from "@/lib/admin/settings";
import type { TypedClient } from "@/server/db/types";

export async function getSettings(db: TypedClient): Promise<Settings> {
  const { data, error } = await db.from("settings").select("key, value");
  if (error) throw new Error(`load settings failed: ${error.message}`);
  const stored = new Map(data.map((r) => [r.key, r.value]));
  const keys = Object.keys(SETTINGS) as SettingKey[];
  return Object.fromEntries(keys.map((k) => [k, parseSetting(k, stored.get(k))])) as Settings;
}
```

`src/server/admin/risk.ts`:

```ts
import { assessRisk, type RiskReason, type RiskThresholds } from "@/lib/admin/risk";
import { renderTemplate, type Settings } from "@/lib/admin/settings";
import type { TypedClient } from "@/server/db/types";
import { listClients, type ClientRow } from "./clients";
import type { Mailer } from "./mailer";
import { recordMessage } from "./notes";

export async function listAtRisk(
  db: TypedClient,
  thresholds: RiskThresholds,
  now = new Date(),
  search?: string,
): Promise<{ client: ClientRow; reasons: RiskReason[] }[]> {
  const { rows } = await listClients(db, { limit: 1000, search });
  return rows
    .map((client) => ({ client, reasons: assessRisk(client, thresholds, now) }))
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || (a.client.lastDoneAt ?? "").localeCompare(b.client.lastDoneAt ?? ""));
}

export async function sendNudge(
  db: TypedClient,
  mailer: Mailer,
  userId: string,
  templates: Settings["email_templates"],
): Promise<{ delivered: boolean }> {
  const { data: profile, error } = await db.from("profiles").select("name, email").eq("id", userId).single();
  if (error) throw new Error(`load client failed: ${error.message}`);
  const vars = { name: profile.name || "здравей" };
  const subject = renderTemplate(templates.nudgeSubject, vars);
  const text = renderTemplate(templates.nudgeBody, vars);
  const result = await mailer.send({ to: profile.email, toName: profile.name || undefined, subject, text });
  const prefix = result.delivered ? "" : "(НЕ Е ИЗПРАТЕНО — няма настроен имейл доставчик или грешка)\n";
  await recordMessage(db, userId, `${prefix}${subject}\n\n${text}`);
  return result;
}
```

Run: `pnpm test:db supabase/tests/admin-risk.test.ts` → PASS.

- [ ] **Step 3: Actions and pages**

`src/app/admin/(panel)/at-risk/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { createMailer } from "@/server/admin/mailer";
import { addNote } from "@/server/admin/notes";
import { requireAdmin } from "@/server/admin/require-admin";
import { sendNudge } from "@/server/admin/risk";
import { getSettings } from "@/server/admin/settings";

export async function nudgeAction(userId: string): Promise<ActionResult<{ delivered: boolean }>> {
  try {
    const { supabase } = await requireAdmin();
    const settings = await getSettings(supabase);
    const result = await sendNudge(supabase, createMailer(serverEnv), z.uuid().parse(userId), settings.email_templates);
    revalidatePath("/admin/at-risk");
    return actionOk(result);
  } catch (error) {
    return actionFail(error);
  }
}

export async function snoozeAction(userId: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await addNote(supabase, z.uuid().parse(userId), { kind: "snooze", days: 7 });
    revalidatePath("/admin/at-risk");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function callNoteAction(userId: string, body: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await addNote(supabase, z.uuid().parse(userId), { kind: "call", body });
    revalidatePath("/admin/at-risk");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}
```

`src/app/admin/(panel)/at-risk/risk-actions.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { callNoteAction, nudgeAction, snoozeAction } from "./actions";

export function RiskActions({ userId, phone }: { userId: string; phone: string | null }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={() => {
            const body = prompt("Бележка от разговора (по желание):") ?? "";
            startTransition(async () => {
              const r = await callNoteAction(userId, body);
              setMessage(r.ok ? "Обаждането е записано ✓" : r.message);
            });
          }}
          className="rounded-full bg-moss px-3 py-2 text-sm font-semibold text-white"
        >
          Обади се
        </a>
      )}
      <Button
        variant="quiet"
        size="md"
        disabled={pending}
        onClick={() =>
          confirm("Да изпратя ли имейла по шаблон?") &&
          startTransition(async () => {
            const r = await nudgeAction(userId);
            setMessage(r.ok ? (r.data.delivered ? "Изпратено ✓" : "Записано, но НЕ е изпратено (няма имейл доставчик)") : r.message);
          })
        }
      >
        Изпрати съобщение
      </Button>
      <Button
        variant="quiet"
        size="md"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await snoozeAction(userId);
            setMessage(r.ok ? "Отложено със 7 дни ✓" : r.message);
          })
        }
      >
        Отложи 7 дни
      </Button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  );
}
```

`src/app/admin/(panel)/at-risk/page.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { completionPct, RISK_LABEL } from "@/lib/admin/risk";
import { utcToZoned } from "@/lib/admin/time";
import { requireAdmin } from "@/server/admin/require-admin";
import { listAtRisk } from "@/server/admin/risk";
import { getSettings } from "@/server/admin/settings";
import { RiskActions } from "./risk-actions";

export const metadata = { title: "Изостават" };

export default function AtRiskPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <AtRisk />
    </Suspense>
  );
}

async function AtRisk() {
  await connection();
  const { supabase } = await requireAdmin();
  const settings = await getSettings(supabase);
  const list = await listAtRisk(supabase, settings.risk);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Изостават <span className="text-ink-soft">({list.length})</span></h1>
        <p className="text-sm text-ink-soft">
          Без тренировка ≥ {settings.risk.inactiveDays} дни · под {settings.risk.minCompletionPct}% за 14 дни · платила без тренировка · неуспешно плащане.{" "}
          <Link href="/admin/settings" className="underline">Промени праговете</Link>
        </p>
      </header>
      <ul className="space-y-3">
        {list.map(({ client: c, reasons }) => (
          <li key={c.userId} className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/clients/${c.userId}`} className="font-semibold hover:underline">{c.name || c.email}</Link>
              <LevelBadge level={c.level} />
              {reasons.map((r) => (
                <span key={r} className="rounded-full bg-brick/10 px-2 py-0.5 text-xs font-semibold text-brick">{RISK_LABEL[r]}</span>
              ))}
            </div>
            <p className="text-sm text-ink-soft">
              Последна тренировка: {c.lastDoneAt ? utcToZoned(c.lastDoneAt).date : "никога"} · 14 дни: {c.doneRegular14}/{c.published14}
              {completionPct(c.doneRegular14, c.published14) !== null ? ` (${completionPct(c.doneRegular14, c.published14)}%)` : ""}
            </p>
            <RiskActions userId={c.userId} phone={c.phoneCallConsent ? c.phone : null} />
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="text-ink-soft">Всички тренират. 🎉</p>}
    </div>
  );
}
```

`src/app/admin/(panel)/activity/page.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { completionPct } from "@/lib/admin/risk";
import { cn } from "@/lib/cn";
import { listClients, type ClientRow } from "@/server/admin/clients";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Активност" };

const SORTS = {
  done7: { label: "Тренировки 7д", key: (c: ClientRow) => c.done7 },
  done30: { label: "Тренировки 30д", key: (c: ClientRow) => c.done30 },
  minutes7: { label: "Минути 7д", key: (c: ClientRow) => c.minutes7 },
  minutes30: { label: "Минути 30д", key: (c: ClientRow) => c.minutes30 },
  pct: { label: "% за 14д", key: (c: ClientRow) => completionPct(c.doneRegular14, c.published14) ?? -1 },
} as const;
type SortKey = keyof typeof SORTS;

export default function ActivityPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  await connection();
  const { sort: raw } = await searchParams;
  const sort: SortKey = raw && raw in SORTS ? (raw as SortKey) : "done7";
  const { supabase } = await requireAdmin();
  const { rows } = await listClients(supabase, { limit: 1000 });
  const subscribers = rows.filter((c) => c.hasAccess).sort((a, b) => SORTS[sort].key(b) - SORTS[sort].key(a));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Активност</h1>
      <p className="text-sm text-ink-soft">Само клиентки с достъп. Серията се вижда в профила на всяка клиентка.</p>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Клиентка</th>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <th key={k} className="p-3">
                  <Link href={`?sort=${k}`} className={cn("hover:underline", k === sort && "font-bold text-ink")}>{SORTS[k].label}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subscribers.map((c) => {
              const pct = completionPct(c.doneRegular14, c.published14);
              return (
                <tr key={c.userId} className="border-t border-line">
                  <td className="p-3"><Link href={`/admin/clients/${c.userId}`} className="font-semibold hover:underline">{c.name || c.email}</Link> <LevelBadge level={c.level} /></td>
                  <td className="p-3 tabular-nums">{c.done7}</td>
                  <td className="p-3 tabular-nums">{c.done30}</td>
                  <td className="p-3 tabular-nums">{c.minutes7}</td>
                  <td className="p-3 tabular-nums">{c.minutes30}</td>
                  <td className="p-3 tabular-nums">{pct === null ? "—" : `${pct}% (${c.doneRegular14}/${c.published14})`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {subscribers.length === 0 && <p className="p-4 text-ink-soft">Още няма клиентки с достъп.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

`pnpm typecheck && pnpm lint && pnpm test:db && pnpm build` → 0. Browser as aal2 admin: a subscriber with no workouts in 5+ days appears in „Изостават" with „Не тренира"; „Изпрати съобщение" without Brevo env → „Записано, но НЕ е изпратено"; the note is visible on her client page; „Отложи 7 дни" removes her from the list; „Обади се" only for clients with call consent. Activity sorts by each column. `preview_stop`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(admin): activity table and at-risk list with call, message and snooze

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Dashboard, settings (plans, provider, tracking IDs, thresholds, templates), audit log

**Files:**
- Create: `src/server/admin/dashboard.ts`, `src/server/admin/audit.ts`, `supabase/tests/admin-settings.test.ts`, `src/app/admin/(panel)/settings/page.tsx`, `src/app/admin/(panel)/settings/forms.tsx`, `src/app/admin/(panel)/settings/actions.ts`, `src/app/admin/(panel)/audit/page.tsx`
- Modify: `src/server/admin/settings.ts` (+ `saveSetting`, `listPlans`, `savePlan`), `src/app/admin/(panel)/page.tsx` (real dashboard)

**Interfaces:**
- Consumes: `admin_dashboard` RPC, `SETTINGS`, `formatPrice`, `requireAdmin`, `ActionForm`, form-data helpers.
- Produces:
  - `dashboardSchema` (zod for the jsonb) and `getDashboard(db, now?: Date): Promise<Dashboard>`
  - `saveSetting<K extends SettingKey>(db, key: K, raw: unknown): Promise<void>`
  - `planInputSchema`, `listPlans(db)`, `savePlan(db, id: string | null, raw: unknown): Promise<void>`
  - `listAudit(db, opts?: { beforeId?: number; limit?: number }): Promise<{ id: number; createdAt: string; actorName: string; action: string; targetType: string; targetId: string | null; diff: unknown }[]>`

- [ ] **Step 1: Write the failing DB tests**

`supabase/tests/admin-settings.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { listAudit } from "@/server/admin/audit";
import { getDashboard } from "@/server/admin/dashboard";
import { getSettings, listPlans, savePlan, saveSetting } from "@/server/admin/settings";
import { adminClient, createAdminUser, type TypedClient } from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;

beforeAll(async () => {
  admin = adminClient();
  const created = await createAdminUser(admin, "set-admin");
  boss = created.db;
  bossId = created.user.id;
  await admin.from("profiles").update({ name: "Шефката" }).eq("id", bossId);
});

describe("settings service", () => {
  it("saves a valid setting and rejects an invalid one", async () => {
    await saveSetting(boss, "risk", { inactiveDays: 7, minCompletionPct: 40 });
    expect((await getSettings(boss)).risk).toEqual({ inactiveDays: 7, minCompletionPct: 40 });
    await expect(saveSetting(boss, "risk", { inactiveDays: 0, minCompletionPct: 40 })).rejects.toThrow();
    await boss.from("settings").delete().eq("key", "risk");
  });

  it("creates and edits a plan", async () => {
    const name = `План ${Date.now()}`;
    await savePlan(boss, null, { name, interval: "month", priceCents: 2490, active: false, sort: 9 });
    const created = (await listPlans(boss)).find((p) => p.name === name)!;
    expect(created).toMatchObject({ price_cents: 2490, active: false });
    await savePlan(boss, created.id, { name, interval: "month", priceCents: 2990, active: false, sort: 9 });
    expect((await listPlans(boss)).find((p) => p.id === created.id)?.price_cents).toBe(2990);
  });

  it("shows the audit trail with the actor's name", async () => {
    const entries = await listAudit(boss, { limit: 20 });
    expect(entries.some((e) => e.targetType === "plans" && e.actorName === "Шефката")).toBe(true);
  });
});

describe("dashboard service", () => {
  it("parses the dashboard payload", async () => {
    const d = await getDashboard(boss);
    expect(d.visits.d30).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(d.sources)).toBe(true);
    expect(typeof d.subscriptions.mrr_cents).toBe("number");
  });
});
```

Run: `pnpm test:db supabase/tests/admin-settings.test.ts` → FAIL.

- [ ] **Step 2: Implement services**

Append to `src/server/admin/settings.ts`:

```ts
import { z } from "zod";

export async function saveSetting<K extends SettingKey>(db: TypedClient, key: K, raw: unknown): Promise<void> {
  const value = SETTINGS[key].parse(raw);
  const { error } = await db.from("settings").upsert({ key, value });
  if (error) throw new Error(`save setting failed: ${error.message}`);
}

export const planInputSchema = z.object({
  name: z.string().trim().min(1, "Нужно е име").max(60),
  interval: z.enum(["month", "year"]),
  priceCents: z.number().int().min(1, "Цената трябва да е положителна").max(1_000_000),
  active: z.boolean(),
  sort: z.number().int().min(0).max(100),
});

export async function listPlans(db: TypedClient) {
  const { data, error } = await db.from("plans").select("id, name, interval, price_cents, currency, active, sort").order("sort");
  if (error) throw new Error(`load plans failed: ${error.message}`);
  return data;
}

export async function savePlan(db: TypedClient, id: string | null, raw: unknown): Promise<void> {
  const p = planInputSchema.parse(raw);
  const row = { name: p.name, interval: p.interval, price_cents: p.priceCents, active: p.active, sort: p.sort };
  const { error } = id ? await db.from("plans").update(row).eq("id", id) : await db.from("plans").insert(row);
  if (error) throw new Error(`save plan failed: ${error.message}`);
}
```

(Merge the `import { z }` into the file's import block.)

`src/server/admin/dashboard.ts`:

```ts
import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

const n = z.coerce.number();
export const dashboardSchema = z.object({
  visits: z.object({ today: n, d7: n, d30: n, unique_d30: n }),
  sources: z.array(z.object({ source: z.string(), visits: n })),
  funnel: z.object({ visitors: n, signups: n, free_done: n, paid: n }),
  registrations: z.object({ d7: n, d30: n }),
  subscriptions: z.object({ active: n, mrr_cents: n, canceled_30: n }),
  top_workouts: z.array(z.object({ id: z.string(), title: z.string(), completions: n })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export async function getDashboard(db: TypedClient, now = new Date()): Promise<Dashboard> {
  const { data, error } = await db.rpc("admin_dashboard", { p_now: now.toISOString() });
  if (error) throw new Error(`load dashboard failed: ${error.message}`);
  return dashboardSchema.parse(data);
}
```

`src/server/admin/audit.ts`:

```ts
import type { TypedClient } from "@/server/db/types";

export async function listAudit(db: TypedClient, opts: { beforeId?: number; limit?: number } = {}) {
  let query = db
    .from("audit_log")
    .select("id, actor_id, action, target_type, target_id, diff, created_at")
    .order("id", { ascending: false })
    .limit(Math.min(opts.limit ?? 100, 200));
  if (opts.beforeId) query = query.lt("id", opts.beforeId);
  const { data, error } = await query;
  if (error) throw new Error(`load audit failed: ${error.message}`);
  const actorIds = [...new Set(data.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: people, error: peopleError } = await db.from("profiles").select("id, name, email").in("id", actorIds);
    if (peopleError) throw new Error(`load actors failed: ${peopleError.message}`);
    for (const p of people) names.set(p.id, p.name || p.email);
  }
  return data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actorName: r.actor_id ? (names.get(r.actor_id) ?? "изтрит потребител") : "система",
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    diff: r.diff,
  }));
}
```

Run: `pnpm test:db supabase/tests/admin-settings.test.ts` → PASS.

- [ ] **Step 3: Settings actions and page**

`src/app/admin/(panel)/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formBool, formInt, formString } from "@/lib/form-data";
import { requireAdmin } from "@/server/admin/require-admin";
import { savePlan, saveSetting } from "@/server/admin/settings";

async function run(fn: (db: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) => Promise<void>): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await fn(supabase);
    revalidatePath("/admin/settings");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function saveRiskAction(_prev: unknown, form: FormData) {
  return run((db) => saveSetting(db, "risk", { inactiveDays: formInt(form, "inactiveDays"), minCompletionPct: formInt(form, "minCompletionPct") }));
}

export async function saveProviderAction(_prev: unknown, form: FormData) {
  return run((db) => saveSetting(db, "payment_provider", { provider: formString(form, "provider") }));
}

export async function saveTrackingAction(_prev: unknown, form: FormData) {
  return run((db) =>
    saveSetting(db, "tracking", {
      metaPixelId: formString(form, "metaPixelId"),
      ga4Id: formString(form, "ga4Id"),
      gtmId: formString(form, "gtmId"),
      googleAdsId: formString(form, "googleAdsId"),
    }),
  );
}

export async function saveTemplatesAction(_prev: unknown, form: FormData) {
  return run((db) => saveSetting(db, "email_templates", { nudgeSubject: formString(form, "nudgeSubject"), nudgeBody: formString(form, "nudgeBody") }));
}

export async function savePlanAction(id: string | null, _prev: unknown, form: FormData) {
  const euros = formString(form, "price").replace(",", ".");
  return run((db) =>
    savePlan(db, id, {
      name: formString(form, "name"),
      interval: formString(form, "interval"),
      priceCents: /^\d+(\.\d{1,2})?$/.test(euros) ? Math.round(Number(euros) * 100) : Number.NaN,
      active: formBool(form, "active"),
      sort: formInt(form, "sort"),
    }),
  );
}
```

`src/app/admin/(panel)/settings/forms.tsx`:

```tsx
"use client";

import { ActionForm } from "@/components/admin/action-form";
import { Field, inputClass } from "@/components/ui/field";
import type { Settings } from "@/lib/admin/settings";
import {
  savePlanAction,
  saveProviderAction,
  saveRiskAction,
  saveTemplatesAction,
  saveTrackingAction,
} from "./actions";

type Plan = { id: string; name: string; interval: "month" | "year"; price_cents: number; active: boolean; sort: number };

function PlanForm({ plan }: { plan?: Plan }) {
  return (
    <ActionForm action={savePlanAction.bind(null, plan?.id ?? null)} submitLabel={plan ? "Запази" : "Добави план"} resetOnSuccess={!plan} className="grid items-end gap-2 rounded-xl bg-paper p-3 sm:grid-cols-6">
      <Field label="Име"><input name="name" defaultValue={plan?.name} required className={inputClass + " h-11"} /></Field>
      <Field label="Период">
        <select name="interval" defaultValue={plan?.interval ?? "month"} className={inputClass + " h-11"}>
          <option value="month">Месец</option>
          <option value="year">Година</option>
        </select>
      </Field>
      <Field label="Цена €"><input name="price" inputMode="decimal" defaultValue={plan ? (plan.price_cents / 100).toFixed(2) : ""} required className={inputClass + " h-11"} /></Field>
      <Field label="Ред"><input name="sort" type="number" min={0} max={100} defaultValue={plan?.sort ?? 0} className={inputClass + " h-11"} /></Field>
      <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="active" defaultChecked={plan?.active ?? true} /> Активен</label>
    </ActionForm>
  );
}

export function SettingsForms({ settings, plans }: { settings: Settings; plans: Plan[] }) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">Планове и цени</h2>
        <p className="text-sm text-ink-soft">Плановете не се трият — изключи „Активен", за да спре да се предлага. Свързването със Stripe/Revolut идва в 1C.</p>
        {plans.map((p) => <PlanForm key={p.id} plan={p} />)}
        <PlanForm />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Доставчик на плащания</h2>
        <ActionForm action={saveProviderAction} submitLabel="Запази" className="flex items-end gap-2">
          <select name="provider" defaultValue={settings.payment_provider.provider} className={inputClass + " h-11 max-w-xs"}>
            <option value="stripe">Stripe</option>
            <option value="revolut">Revolut</option>
          </select>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Проследяване (ID-та)</h2>
        <p className="text-sm text-ink-soft">Тайните ключове (CAPI token, GA4 secret) се пазят в настройките на сървъра, не тук.</p>
        <ActionForm action={saveTrackingAction} submitLabel="Запази" className="grid gap-2 sm:grid-cols-2">
          <Field label="Meta Pixel ID"><input name="metaPixelId" defaultValue={settings.tracking.metaPixelId} className={inputClass} /></Field>
          <Field label="GA4 ID"><input name="ga4Id" defaultValue={settings.tracking.ga4Id} placeholder="G-XXXXXXX" className={inputClass} /></Field>
          <Field label="GTM ID"><input name="gtmId" defaultValue={settings.tracking.gtmId} placeholder="GTM-XXXXXX" className={inputClass} /></Field>
          <Field label="Google Ads ID"><input name="googleAdsId" defaultValue={settings.tracking.googleAdsId} placeholder="AW-123456789" className={inputClass} /></Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Прагове за „Изостават"</h2>
        <ActionForm action={saveRiskAction} submitLabel="Запази" className="flex flex-wrap items-end gap-2">
          <Field label="Дни без тренировка"><input name="inactiveDays" type="number" min={1} max={60} defaultValue={settings.risk.inactiveDays} className={inputClass + " h-11 w-28"} /></Field>
          <Field label="Минимален % за 14 дни"><input name="minCompletionPct" type="number" min={0} max={100} defaultValue={settings.risk.minCompletionPct} className={inputClass + " h-11 w-28"} /></Field>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Имейл „Липсваш ни"</h2>
        <p className="text-sm text-ink-soft">Използвай {"{{name}}"} за името на клиентката.</p>
        <ActionForm action={saveTemplatesAction} submitLabel="Запази">
          <Field label="Тема"><input name="nudgeSubject" defaultValue={settings.email_templates.nudgeSubject} maxLength={150} className={inputClass} /></Field>
          <Field label="Текст"><textarea name="nudgeBody" defaultValue={settings.email_templates.nudgeBody} rows={6} maxLength={4000} className={inputClass + " h-auto py-3"} /></Field>
        </ActionForm>
      </section>
    </div>
  );
}
```

`src/app/admin/(panel)/settings/page.tsx`:

```tsx
import { connection } from "next/server";
import { Suspense } from "react";
import { requireAdmin } from "@/server/admin/require-admin";
import { getSettings, listPlans } from "@/server/admin/settings";
import { SettingsForms } from "./forms";

export const metadata = { title: "Настройки" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  await connection();
  const { supabase } = await requireAdmin();
  const [settings, plans] = await Promise.all([getSettings(supabase), listPlans(supabase)]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Настройки</h1>
      <SettingsForms settings={settings} plans={plans} />
    </div>
  );
}
```

- [ ] **Step 4: Dashboard and audit pages**

Replace `src/app/admin/(panel)/page.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatPrice } from "@/lib/format";
import { getDashboard } from "@/server/admin/dashboard";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Табло" };

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await connection();
  const { supabase } = await requireAdmin();
  const d = await getDashboard(supabase);
  const churn = d.subscriptions.active + d.subscriptions.canceled_30 > 0
    ? Math.round((d.subscriptions.canceled_30 / (d.subscriptions.active + d.subscriptions.canceled_30)) * 100)
    : 0;
  const step = (a: number, b: number) => (a > 0 ? `${Math.round((b / a) * 100)}%` : "—");

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold">Табло</h1>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Посещения днес" value={d.visits.today} />
        <Tile label="Посещения 7 дни" value={d.visits.d7} />
        <Tile label="Посещения 30 дни" value={d.visits.d30} hint={`${d.visits.unique_d30} уникални`} />
        <Tile label="Регистрации 7 / 30 дни" value={`${d.registrations.d7} / ${d.registrations.d30}`} />
        <Tile label="Активни абонаменти" value={d.subscriptions.active} />
        <Tile label="MRR" value={formatPrice(d.subscriptions.mrr_cents, "EUR")} />
        <Tile label="Откази 30 дни" value={d.subscriptions.canceled_30} hint={`churn ≈ ${churn}%`} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Фуния (30 дни)</h2>
        <ol className="grid gap-2 sm:grid-cols-4">
          <Tile label="Посетители" value={d.funnel.visitors} />
          <Tile label="Регистрации" value={d.funnel.signups} hint={step(d.funnel.visitors, d.funnel.signups)} />
          <Tile label="Безплатна тренировка" value={d.funnel.free_done} hint={step(d.funnel.signups, d.funnel.free_done)} />
          <Tile label="Платили" value={d.funnel.paid} hint={step(d.funnel.free_done, d.funnel.paid)} />
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold">Източници (30 дни)</h2>
          <ul className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
            {d.sources.map((s) => (
              <li key={s.source} className="flex justify-between border-b border-line py-1 last:border-0"><span>{s.source}</span><span className="tabular-nums">{s.visits}</span></li>
            ))}
            {d.sources.length === 0 && <li className="text-ink-soft">Още няма посещения.</li>}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">Най-гледани (30 дни)</h2>
          <ul className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
            {d.top_workouts.map((w) => (
              <li key={w.id} className="flex justify-between border-b border-line py-1 last:border-0">
                <Link href={`/admin/workouts/${w.id}`} className="hover:underline">{w.title}</Link><span className="tabular-nums">{w.completions}</span>
              </li>
            ))}
            {d.top_workouts.length === 0 && <li className="text-ink-soft">Още няма завършени тренировки.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
```

`src/app/admin/(panel)/audit/page.tsx`:

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { utcToZoned } from "@/lib/admin/time";
import { listAudit } from "@/server/admin/audit";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Одит" };
const TYPE: Record<string, string> = { workouts: "Тренировка", workout_media: "Видео линк", plans: "План", subscriptions: "Абонамент", settings: "Настройка", profiles: "Роля" };
const ACTION: Record<string, string> = { insert: "създаде", update: "промени", delete: "изтри" };

export default function AuditPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

async function Audit({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await connection();
  const { before } = await searchParams;
  const { supabase } = await requireAdmin();
  const entries = await listAudit(supabase, { beforeId: Number(before) || undefined, limit: 100 });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Одит</h1>
      <ul className="space-y-2 text-sm">
        {entries.map((e) => {
          const at = utcToZoned(e.createdAt);
          return (
            <li key={e.id} className="rounded-xl bg-white p-3 ring-1 ring-line">
              <p><span className="tabular-nums text-ink-soft">{at.date} {at.time}</span> · <strong>{e.actorName}</strong> {ACTION[e.action] ?? e.action} {TYPE[e.targetType] ?? e.targetType} <span className="text-ink-soft">{e.targetId}</span></p>
              <details>
                <summary className="cursor-pointer text-ink-soft">Детайли</summary>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(e.diff, null, 2)}</pre>
              </details>
            </li>
          );
        })}
      </ul>
      {entries.length === 100 && <Link href={`?before=${entries.at(-1)!.id}`} className={buttonClass("quiet", "md")}>По-стари →</Link>}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:db && pnpm build` → 0. Browser as aal2 admin: dashboard shows tiles, funnel percentages, sources and top workouts (seed data + your test actions); settings saves each section (invalid GA4 id shows the Bulgarian error), plan price edit reflects on `/app/plan` for a no-access client; audit lists the changes you just made with your name and expandable diffs. 375px: no page-level horizontal scroll. `preview_stop`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(admin): dashboard, settings with plans and templates, audit log viewer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Follow-ups, README and full verification

**Files:**
- Modify: `src/server/content/today.ts` (profile error vs not found), `README.md` (admin section), `docs/superpowers/plans/2026-10-14-fit-platform-1a-followups.md` (tick the 1B items done)

- [ ] **Step 1: Distinguish profile errors in getTodayView**

In `src/server/content/today.ts`, replace the single `if (profileRes.error || !profileRes.data) throw new AppError("NOT_FOUND", …)` with:

```ts
  if (profileRes.error && profileRes.error.code !== "PGRST116") {
    throw new Error(`load profile failed: ${profileRes.error.message}`);
  }
  if (!profileRes.data) throw new AppError("NOT_FOUND", "Профилът не е намерен.");
```

Run: `pnpm test:db supabase/tests/today.test.ts` → PASS.

- [ ] **Step 2: README admin section**

Add to `README.md` a section „Admin":

```markdown
## Admin

- Promote an account (local): `node --env-file=.env.local scripts/make-admin.mjs you@example.com`.
  Hosted: `update public.profiles set role = 'admin' where email = 'you@example.com';` in the SQL editor.
- First visit to `/admin` asks for TOTP enrolment (Google Authenticator / 1Password). Every new session needs the 6-digit code.
  Without it the account is treated as a normal client everywhere (the database enforces this via `is_admin()` = role admin + aal2).
- Hosted Supabase: enable **Authentication → Multi-factor → TOTP** (enroll + verify) — or `supabase config push`.
- Optional email for „Изпрати съобщение": `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS` (verified sender in Brevo), `EMAIL_FROM_NAME`.
  Without them the message is recorded on the client but not sent.
- Workouts that clients completed cannot be deleted — „Скрий" turns them back into drafts.
```

- [ ] **Step 3: Full verification**

```bash
export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg
pnpm typecheck && pnpm lint && pnpm test && pnpm db:reset && pnpm test:db && pnpm build
```

Expected: every command exits 0. Then an end-to-end browser walk-through (desktop 1280px + mobile 375px):
1. New user via `/start` → promote with `make-admin.mjs` → `/admin` → TOTP enrolment → dashboard.
2. Calendar: bulk-add 3 links over Tue/Thu/Sat → cards on the right days; drag one to another day.
3. A second (client) account: onboarding → free workout → appears in Clients and on the dashboard funnel.
4. Grant her 30 days manual access → client app unlocks; set her `joined_at` 10 days back via SQL → she appears in „Изостават"; send a message (not delivered without Brevo — note recorded); snooze.
5. Settings: change risk threshold and a plan price; Audit shows every change with the admin's name.
6. Sign out and back in as the admin → `/admin` asks for the TOTP code again; a wrong code is refused.
7. `read_console_messages` (errors only) → none on any admin page.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: admin setup notes; chore: plan 1B follow-ups and verification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
