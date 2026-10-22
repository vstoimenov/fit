# Home + points & levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members land on an „Начало“ home screen and earn points and levels (1–10) with the landing's rewards; admins see and hand out rewards.

**Architecture:** An append-only `points_ledger` filled only by `security definer` triggers (workout completion, weekly check-in) plus an admin-adjustment function; `level_for_points()` in SQL mirrored by a TS helper with a parity test; `workouts.min_member_level` enforced in `can_watch`; Home composes existing today data with the member's points.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`), Supabase (RLS, triggers, security definer), zod 4, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-fit-platform-engagement-design.md` (Phase 1)

## Global Constraints

- Repo `/Users/macbookpro/Downloads/cloude-c/fit-platform`, branch `home-points` (off `main`). Shell `export PATH="$HOME/.npm-global/bin:$PATH" DOCKER_CONFIG=/tmp/dockercfg`; local Supabase `*_fit-platform` only; `pnpm db:reset && pnpm db:types` after migrations; never edit applied migrations; no schema-wide statements (`all tables in schema …`).
- Points exact values: workout completion **10**, once per Sofia day (`source='workout'`, `ref`=`YYYY-MM-DD` of `completed_at` at Europe/Sofia); check-in **5** once per ISO week Europe/Sofia (`source='checkin'`, `ref`=`YYYY-Www`); admin adjustment (`source='admin'`, `ref`=a new uuid, points may be negative, reason required).
- Level thresholds (total points ≥): 1:0 · 2:50 · 3:120 · 4:220 · 5:350 · 6:520 · 7:730 · 8:980 · 9:1270 · 10:1600.
- Rewards copy: 4 „20% отстъпка от следващия абонамент“, 6 „Ексклузивни тренировки“, 8 „Лична консултация с Аксения“, 10 „6 месеца клуб безплатно“.
- Members never insert/update/delete ledger rows (no grants, no policies for that); members select only their own rows; admins (`is_admin()`) select all.
- Next 16 page pattern: sync export → `<Suspense>` → async inner with `await connection()`; env only in `app/**`; services under `src/server/**`/`src/lib/**` never import `src/env.ts`.
- Design rules: tokens, Manrope, one primary (ink pill) per screen, 44px targets, lucide icons, Bulgarian copy, powder never as text.
- Nav labels exactly: „Начало“, „Тренировки“, „Полезно“, „Профил“ (4 tabs in this phase).
- All suites green: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

## Review Focus

1. The same completion or check-in processed twice (retry, double tap, backfill + trigger) → points awarded exactly once. Pinned by the ledger idempotency DB test (Task 1).
2. A member tries to insert/update her own ledger rows or call the admin adjustment → refused. Pinned by the RLS DB test (Task 1).
3. A member below `min_member_level` asks for the video of an exclusive workout → `can_watch` false, no media URL. Pinned by the DB test (Task 1) and the library/workout page check (Task 4).
4. A check-in on Sunday 23:30 Sofia and another on Monday 00:30 → two different ISO weeks, two awards; two on the same week → one. Pinned by the week-key test (Task 1).
5. Level boundary values (219 → 3, 220 → 4, 1600+ → 10, negative total → 1). Pinned by the TS/SQL parity test (Task 2).

---

### Task 1: Migration — points ledger, triggers, levels, rewards_given, exclusive workouts

**Files:**
- Create: `supabase/migrations/20261022100000_points.sql`, `supabase/tests/points-db.test.ts`
- Modify: `supabase/tests/privileges.test.ts` (TABLES list), `src/lib/supabase/database.types.ts` (regenerated)

**Interfaces:**
- Produces:
  - enum `public.points_source` = (`workout`,`checkin`,`challenge`,`live`,`post`,`comment`,`admin`).
  - table `public.points_ledger(id uuid pk, user_id uuid not null references profiles on delete cascade, source points_source not null, ref text not null check (char_length(ref) between 1 and 80), points int not null check (points between -10000 and 10000), reason text check (char_length(reason) <= 200), created_by uuid null, created_at timestamptz default now(), unique (user_id, source, ref))`; index on (user_id, created_at desc).
  - `public.level_for_points(p int) returns int` (immutable, thresholds above; ≤0 → 1).
  - `public.member_points(uid uuid) returns table(points int, level int)` security definer: a member may ask only for herself (`uid = auth.uid()`) unless `is_admin()`; otherwise raises `42501`.
  - triggers: `after insert on workout_completions` → +10 `workout`/completion id; `after insert on check_ins` → +5 `checkin`/ISO week of `created_at` at Europe/Sofia (`to_char(created_at at time zone 'Europe/Sofia', 'IYYY-"W"IW')`); both `on conflict do nothing`, `security definer`, `search_path=''`.
  - backfill in the migration: existing completions and check-ins (same rules, `on conflict do nothing`).
  - `public.admin_adjust_points(p_user_id uuid, p_points int, p_reason text) returns uuid` security definer: `is_admin()` else 42501; reason 1–200 chars else 22023; points ≠ 0 and between -10000 and 10000 else 22023; inserts `source='admin'`, `ref`=gen_random_uuid()::text, `created_by`=auth.uid(); returns the row id.
  - table `public.rewards_given(user_id uuid references profiles on delete cascade, level smallint check (level in (4,8,10)), given_at timestamptz default now(), given_by uuid, note text check (char_length(note) <= 300), primary key (user_id, level))`; RLS: admin all; members select own.
  - `workouts.min_member_level smallint null check (min_member_level between 2 and 10)`; `can_watch(workout_id)` recreated: exactly the current body (read it from `20261014100100_content.sql` and any later redefinition) plus `and (w.min_member_level is null or public.is_admin() or (select level from public.member_points(auth.uid())) >= w.min_member_level)` — keep signature, grants, `security definer`, `search_path`.
  - RLS on `points_ledger`: select own or admin; no insert/update/delete policies; grants: `select` to authenticated only; anon nothing; audit trigger `audit_row('id')` on `rewards_given` and on `points_ledger` (admin adjustments must be auditable).

- [ ] **Step 1: Failing DB tests** (`supabase/tests/points-db.test.ts`, helpers from `access.test.ts`/`completion.test.ts`):
  - completing a workout once → ledger has one `workout` row of 10; a second insert path for the same completion (call the trigger function's insert again via service role `insert … on conflict do nothing` with the same key) → still one row.
  - two check-ins in the same ISO week → one `checkin` row; check-ins at `2026-10-25T21:30:00Z` (Sun 23:30 Sofia) and `2026-10-25T22:30:00Z` (Mon 00:30 Sofia) → two rows with refs `2026-W43` and `2026-W44`.
  - member insert/update/delete on `points_ledger` → refused/0 rows; member select sees only own rows; admin sees all.
  - `member_points(other)` as a member → 42501; as admin → numbers.
  - `admin_adjust_points` as member → 42501; as admin with empty reason → 22023; with +30 → total increases by 30.
  - `level_for_points`: 0→1, 49→1, 50→2, 219→3, 220→4, 1599→9, 1600→10, 5000→10, -20→1.
  - exclusive workout `min_member_level=6`: a member at level 1 → `can_watch` false; after `admin_adjust_points(+520)` → true; admin → true.
  - backfill: covered by `db:reset` on a seed with completions? If the seed has none, insert a completion before applying is not possible in tests — instead assert the backfill SQL by calling a helper `public.points_backfill()` (security definer, revoked from everyone but used once in the migration) — skip if impractical and say so.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** write the migration; `pnpm db:reset && pnpm db:types`; add tables to `privileges.test.ts`.
- [ ] **Step 4:** `pnpm test:db` all green, `pnpm typecheck`, `pnpm lint`.
- [ ] **Step 5:** commit `feat(db): points ledger, levels, rewards and exclusive workouts`.

### Task 2: Points service + level helper

**Files:**
- Create: `src/lib/points/levels.ts`, `src/lib/points/levels.test.ts`, `src/server/content/points.ts`, `supabase/tests/points-parity.test.ts`

**Interfaces:**
- Consumes: Task 1 SQL.
- Produces:
  - `LEVEL_THRESHOLDS: readonly number[]` (10 values above), `REWARDS: Record<4|6|8|10, string>` (copy above).
  - `levelForPoints(points: number): number`; `levelProgress(points: number): { level: number; points: number; nextLevel: number | null; toNext: number | null; percent: number; nextReward: string | null }` — `percent` 0–100 within the current band; at 10 → `nextLevel/toNext/nextReward` null, percent 100; `nextReward` = reward of the next rewarded level ≥ nextLevel (4/6/8/10) else null.
  - `getMemberPoints(db: TypedClient, userId: string): Promise<{ points: number; level: number }>` (rpc `member_points`; error → throw).
  - `listPointsLedger(db, userId, limit=20)`.

- [ ] **Step 1: Failing tests:** `levels.test.ts` (boundaries from Review Focus 5; `levelProgress(140)` → level 3, nextLevel 4, toNext 80, percent `Math.round((140-120)/(220-120)*100)`=20, nextReward „20% отстъпка от следващия абонамент“; `levelProgress(1700)` → level 10, nulls, 100); `points-parity.test.ts` loops 0..1700 step 10 plus each threshold ±1 comparing `level_for_points` rpc (service role) with `levelForPoints`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** green + typecheck/lint. **Step 5:** commit `feat(points): level helper mirrored from SQL and points service`.

### Task 3: Начало (home) + nav + after-workout points

**Files:**
- Modify: `src/app/app/page.tsx` (home), `src/lib/app-nav.ts` (+ test), `src/components/app/nav-icons.ts`, `src/components/workout/after-workout.tsx`, `src/app/app/workout/[id]/actions.ts` (return points), `src/app/app/profile/page.tsx` (a „Прогрес“ link card)
- Create: `src/components/home/level-card.tsx`

**Interfaces:**
- Consumes: `getTodayView` (unchanged), `getMemberPoints`, `levelProgress`, `listArticlesFor` (newest one), existing today components.
- Produces: `APP_NAV` = Начало `/app` · Тренировки `/app/library` · Полезно `/app/learn` · Профил `/app/profile`; `activeNavHref("/app/progress")` and `"/app/check-in"` → `/app/profile`. `completeWorkout` additionally returns `points: { total: number; level: number; gained: number; levelUp: boolean } | null` (null on read failure, never failing the completion).

- [ ] **Step 1: Failing tests:** `app-nav.test.ts` updated for 4 tabs and the progress mapping; `actions.test.ts` asserts `points` present on success and `null` when the points read throws.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Home layout (mobile order): date + „Здравей, {name}“; `LevelCard` (chip „Ниво N · P т.“, powder bar, „Още X точки до ниво N+1 · {nextReward}“ or „Максимално ниво“); today's workout as a compact photo card (cover + title band + „Започни“ primary; all existing today states and copy kept, including locked/rest/countdown/past-due banner); week strip + tiles; „Прогрес“ card → `/app/progress`; newest article card for her level when one exists. Desktop: two columns. After-workout: under the stats line „+10 точки · общо P“ and on level-up a line „Ниво N! {reward or „Продължавай така.“}“.
- [ ] **Step 4:** full checks; browser at 320/375/1280 (fresh member: level 1; after one workout: +10; set points via `admin_adjust_points` locally to see a level-up and level 10).
- [ ] **Step 5:** commit `feat(app): Начало home with level card, four-tab nav, points after a workout`.

### Task 4: Admin rewards, points on the client page, exclusive workouts in UI

**Files:**
- Create: `src/server/admin/rewards.ts`, `supabase/tests/admin-rewards.test.ts`, `src/app/admin/(panel)/rewards/{page.tsx,actions.ts}`
- Modify: `src/components/admin/admin-nav.tsx` („Награди“), `src/app/admin/(panel)/clients/[id]/page.tsx` (points, level, last 20 ledger rows, adjust form), `src/app/admin/(panel)/workouts/workout-form.tsx` + `src/server/admin/workouts*` (field „Само от ниво“ none/2–10), `src/app/app/library/page.tsx` + workout card/page (lock „Отключва се на ниво N“ for lower levels; no player)

**Interfaces:**
- Produces: `listRewardCandidates(db): Promise<Array<{ userId; name; email; level; points; reached: Array<{ level: 4|8|10; given: boolean; givenAt: string|null }> }>>` (members with level ≥ 4); `setRewardGiven(db, userId, level: 4|8|10, given: boolean, note?: string)`; `adjustPoints(db, userId, points, reason)` → rpc `admin_adjust_points` with error mapping (42501 FORBIDDEN, 22023 INVALID).

- [ ] **Step 1: Failing tests:** `admin-rewards.test.ts` (candidates include a member at 230 points with level 4 not given; toggling given round-trips; a member cannot call these; adjust with empty reason → INVALID).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement pages (Награди: table by member — name, level, points, chips per reward with „Дадено“ toggles; level 10 row links to the client page's manual grant), client page block, workout form field, library/workout lock.
- [ ] **Step 4:** full checks; browser as admin (test-mode flag locally, restore after) and as a level-1 member on an exclusive workout.
- [ ] **Step 5:** commit `feat(admin): rewards list, points on client page, exclusive workouts`.
