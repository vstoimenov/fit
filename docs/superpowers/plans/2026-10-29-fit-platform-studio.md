# In-person trainings („На място“) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clients book Аксения's gym trainings themselves at `/na-myasto` (spots shown, a visit taken from their punch card on booking, cancel up to 6 h before) and see their card; Аксения runs schedule, rosters, cards and walk-ins from `/admin/na-myasto`.

**Architecture:** Postgres owns every count: weekly `studio_slots` are materialised into dated `studio_sessions`; bookings, cancellations, cards and adjustments change only through security-definer RPCs that lock the session/card rows, so spots and visits can never drift. Thin `src/server/studio/*` modules wrap the RPCs (English reasons from the DB → Bulgarian copy, as `src/server/gift/redeem.ts` does); pages are server components with small client forms.

**Tech Stack:** Next 16.4.2 (cacheComponents), React 19, Supabase (Postgres + RLS + Auth), zod, vitest (`pnpm test` unit, `pnpm test:db` integration against the local stack).

**Spec:** `docs/superpowers/specs/2026-10-29-fit-platform-studio-design.md`

## Global Constraints

- Cards: `card8` = „Карта 8“, 8 visits, 4 weeks, 50 €; `card12` = „Карта 12“, 12 visits, 6 weeks, 60 €; drop-in „Еднократна“ 7 € paid on site. Fixed constants, not admin-editable.
- Card last valid day = start date + 7 × weeks − 1 (Карта 8 from 2026-11-03 → valid through 2026-11-30). Dates are Europe/Sofia calendar dates.
- A visit is taken at booking. Cancel allowed while `now ≤ starts_at − 6 h`; a no-show keeps the visit used. Admin removal ignores the 6 h rule.
- Booking window: sessions starting after `now` and before `now + 14 days`.
- Card choice: non-voided, date of the training within `starts_on..ends_on`, remaining > 0, earliest `ends_on` first. None → drop-in booking (`card_id null`), copy „Еднократна — плащаш 7 € на място“.
- Clients cannot book a full training; Аксения can add beyond the limit (`over_limit = true`, „над лимита“).
- One active booking per client per session.
- In-person-only client = `profiles.studio_client and not profiles.onboarding_done`. They never see `/start`, the install prompt or the paywall; they are left out of the online club's at-risk list, activity report, dashboard member counts, broadcasts and daily reminders.
- Walk-ins without login use a placeholder e-mail `walkin-<uuid>@na-myasto.invalid`; never shown in UI.
- All user-facing copy in Bulgarian, informal „ти“, female forms; card line format exactly „Карта 8 · остават 5 посещения · валидна до 26.11“.
- RPC errors: `raise exception '<english reason>' using errcode = 'P0001'`; forbidden = `42501`. TS maps reasons to Bulgarian in `studioErrorMessage`.
- Every new admin-edited table gets the `audit_row('id')` trigger and `set_updated_at` where it has `updated_at`.
- TDD: watch each test fail first. After `pnpm test:db`, reset the local flag: `docker exec supabase_db_fit-platform psql -U postgres -d postgres -c "update public.security_flags set enabled = false where key = 'admin_mfa_required'"`.
- The working tree carries unrelated uncommitted edits under `supabase/tests/` from another task: stage only files this plan touches (`git add <paths>`, never `git add -A`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Hosted DB migration and deploy are run by the owner; the last task prints the one command.

## Review Focus

1. Two clients press „Запиши се“ on the last spot at the same moment → exactly one booking, the other sees „Няма свободни места.“ (Task 3, concurrency test.)
2. A training on the card's last day at 23:30 Sofia, or across the DST change (2026-10-25) → date is judged in Sofia time; slot at 18:00 stays 18:00 local on both sides. (Tasks 2 and 3.)
3. Cancelling at exactly 6 h before vs 5 h 59 min → first allowed, second refused. (Task 1 pure + Task 3 DB.)
4. Аксения cancels a training holding card and drop-in bookings → every card visit comes back, the session disappears from booking, the clients are pushed. (Task 5.)
5. An expired or voided card, or one with 0 left, is never picked → the booking becomes drop-in instead of failing. (Task 3.)

---

### Task 1: Rules (pure)

**Files:**
- Create: `src/lib/studio/rules.ts`
- Test: `src/lib/studio/rules.test.ts`

**Interfaces:**
- Produces:
  - `type CardKind = "card8" | "card12"`
  - `STUDIO_CARDS: Record<CardKind, { label: string; visits: number; weeks: number; priceEur: number }>`
  - `DROP_IN_PRICE_EUR = 7`, `CANCEL_HOURS = 6`, `BOOKING_DAYS = 14`, `WALKIN_EMAIL_DOMAIN = "na-myasto.invalid"`
  - `cardEndsOn(startsOn: string, kind: CardKind): string` (ISO dates)
  - `canCancel(startsAt: string, now: Date): boolean`
  - `visitsLeftText(remaining: number): string`
  - `cardLine(card: { kind: CardKind; remaining: number; endsOn: string }): string`
  - `cardWarning(card: { remaining: number; endsOn: string }, today: string): "low" | "expiring" | null`
  - `isPlaceholderEmail(email: string): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
expect(cardEndsOn("2026-11-03", "card8")).toBe("2026-11-30");
expect(cardEndsOn("2026-11-03", "card12")).toBe("2026-12-14");
const start = "2026-11-05T17:00:00.000Z";
expect(canCancel(start, new Date("2026-11-05T11:00:00.000Z"))).toBe(true);   // exactly 6 h
expect(canCancel(start, new Date("2026-11-05T11:01:00.000Z"))).toBe(false);  // 5 h 59
expect(visitsLeftText(1)).toBe("остава 1 посещение");
expect(visitsLeftText(5)).toBe("остават 5 посещения");
expect(visitsLeftText(0)).toBe("няма оставащи посещения");
expect(cardLine({ kind: "card8", remaining: 5, endsOn: "2026-11-26" }))
  .toBe("Карта 8 · остават 5 посещения · валидна до 26.11");
expect(cardWarning({ remaining: 1, endsOn: "2026-12-30" }, "2026-11-01")).toBe("low");
expect(cardWarning({ remaining: 4, endsOn: "2026-11-04" }, "2026-11-01")).toBe("expiring"); // 3 days
expect(cardWarning({ remaining: 4, endsOn: "2026-11-05" }, "2026-11-01")).toBeNull();
expect(cardWarning({ remaining: 0, endsOn: "2026-11-02" }, "2026-11-01")).toBeNull();
expect(isPlaceholderEmail("walkin-1@na-myasto.invalid")).toBe(true);
expect(isPlaceholderEmail("a@b.bg")).toBe(false);
```

- [ ] **Step 2: Run** `pnpm test src/lib/studio/rules.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/lib/studio/rules.ts`. Date arithmetic on ISO date strings via `addDays` from `src/lib/admin/time.ts`. `low` wins over `expiring`; both need `remaining > 0` and `endsOn ≥ today`.
- [ ] **Step 4: Run** `pnpm test src/lib/studio/rules.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(studio): card and booking rules`

---

### Task 2: Schema, schedule and session materialisation

**Files:**
- Create: `supabase/migrations/20261029100000_studio_tables.sql`
- Create: `src/server/studio/schedule.ts`, `src/server/studio/errors.ts`
- Modify: `src/lib/supabase/database.types.ts` (regenerate with `pnpm db:types`)
- Test: `supabase/tests/studio-schedule.test.ts`

**Interfaces:**
- Produces (SQL):
  - `profiles.studio_client boolean not null default false`
  - `studio_slots(id uuid pk, weekday smallint 1–7 ISO Mon=1, start_time time, duration_min smallint 15–180 default 60, title text 2–80, capacity smallint 1–100, active boolean default true, created_at, updated_at)`; admin-only RLS for all verbs.
  - `studio_sessions(id uuid pk, slot_id uuid null → studio_slots on delete set null, starts_at timestamptz, duration_min, title, capacity, cancelled_at timestamptz null, created_at)`, `unique (slot_id, starts_at)`; select for `anon, authenticated` (no personal data); writes admin only.
  - `studio_cards(id uuid pk, user_id → profiles on delete cascade, kind text check in ('card8','card12'), visits smallint, starts_on date, ends_on date, used_before smallint default 0 check (used_before between 0 and visits), voided_at timestamptz, warned_low_at timestamptz, warned_expiry_at timestamptz, created_by uuid, created_at)`; select own or admin; no direct writes.
  - `studio_card_adjustments(id uuid pk, card_id → studio_cards on delete cascade, delta smallint check (delta <> 0), reason text 2–200, created_by uuid, created_at)`; select own (via card) or admin; no direct writes.
  - `studio_bookings(id uuid pk, session_id → studio_sessions on delete restrict, user_id → profiles on delete cascade, card_id uuid null → studio_cards, status text check in ('booked','cancelled') default 'booked', source text check in ('client','admin'), over_limit boolean default false, created_at, cancelled_at, cancelled_by uuid)`; partial unique index `(session_id, user_id) where status = 'booked'`; select own or admin; no direct writes.
  - view `studio_card_status` (`security_invoker = true`): card columns + `adjusted int` (sum of deltas), `booked int` (bookings with status 'booked' on the card), `remaining int = visits − used_before + adjusted − booked`.
  - `studio_schedule(p_from timestamptz, p_to timestamptz)` security definer, granted to `anon, authenticated`: `id, title, starts_at, duration_min, capacity, booked int, cancelled boolean`, not cancelled-filtered (UI shows „Отменена“).
  - `studio_ensure_sessions(p_days int default 14)` security definer, execute revoked from `public, anon, authenticated` (service role only): for every active slot and each Sofia date `today .. today + p_days − 1` whose `isodow` matches, insert `starts_at = (date + start_time) at time zone 'Europe/Sofia'`, `on conflict do nothing`.
- Produces (TS, `src/server/studio/schedule.ts`):
  - `interface StudioSession { id; title; startsAt; durationMin; capacity; booked; spotsLeft; cancelled }`
  - `ensureStudioSessions(service: TypedClient): Promise<void>`
  - `listStudioSchedule(db: TypedClient, now?: Date): Promise<StudioSession[]>` — `now .. now + BOOKING_DAYS`, ordered by `startsAt`; `spotsLeft = max(capacity − booked, 0)`.
- Produces (`src/server/studio/errors.ts`): `studioErrorMessage(dbMessage: string): string` — the reason → copy table below, fallback „Нещо се обърка. Опитай отново.“

| DB reason (substring) | Copy |
|---|---|
| `full` | Няма свободни места. |
| `already booked` | Вече си записана за тази тренировка. |
| `started` | Тренировката вече започна. |
| `not open` | Записването отваря 14 дни преди тренировката. |
| `session cancelled` | Тренировката е отменена. |
| `too late` | Вече не може да се откаже — остават по-малко от 6 часа. |
| `card in use` | От картата вече има записвания. Коригирай посещенията вместо да я анулираш. |
| `negative` | Остатъкът не може да стане отрицателен. |
| `invalid invite` | Поканата е невалидна или изтекла. |

- [ ] **Step 1: Write the failing DB tests** in `supabase/tests/studio-schedule.test.ts`:
  - `ensure creates sessions for active slots in Sofia time`: slot weekday = isodow of a date in range, 18:00 → session `starts_at` equals `zonedToUtc(date, "18:00")`; calling ensure twice leaves one row.
  - `ensure keeps 18:00 local across the DST change`: call the SQL with a fixed base date by inserting the slot and asserting on two dates either side of 2026-10-25 (add an optional `p_today date default null` parameter to `studio_ensure_sessions` for this — production passes nothing).
  - `inactive slots produce nothing`.
  - `anon can read the schedule with counts but not bookings or cards`: anon `rpc("studio_schedule")` returns `booked` count; anon `from("studio_bookings").select()` returns `[]`; client cannot `insert` into `studio_bookings` or `studio_cards` (error).
  - `a client sees only her own cards and bookings`.
- [ ] **Step 2: Run** `pnpm test:db supabase/tests/studio-schedule.test.ts` — Expected: FAIL (relation/function missing).
- [ ] **Step 3: Write the migration**, `pnpm db:reset`, `pnpm db:types`; implement `schedule.ts` and `errors.ts` (unit test for `studioErrorMessage` in `src/server/studio/errors.test.ts`, one assertion per row).
- [ ] **Step 4: Run** `pnpm test:db supabase/tests/studio-schedule.test.ts && pnpm test src/server/studio` — Expected: PASS. Reset the MFA flag.
- [ ] **Step 5: Commit** `feat(studio): tables, schedule and session materialisation`

---

### Task 3: Booking and cancelling (client)

**Files:**
- Create: `supabase/migrations/20261029100100_studio_booking.sql`
- Create: `src/server/studio/booking.ts`
- Test: `supabase/tests/studio-booking.test.ts`

**Interfaces:**
- Consumes: Task 2 tables/view, `studioErrorMessage`.
- Produces (SQL):
  - `studio_pick_card(p_user uuid, p_day date) returns uuid` (internal, revoked from everyone but definer callers): card per Global Constraints, `for update` lock.
  - `studio_book(p_session_id uuid) returns jsonb {booking_id, card_id}` — caller = `auth.uid()`; locks the session row `for update`; reasons `session cancelled`, `started` (`now() ≥ starts_at`), `not open` (`starts_at > now() + 14 days`), `already booked`, `full` (booked ≥ capacity); sets `profiles.studio_client = true`; `source = 'client'`.
  - `studio_cancel(p_booking_id uuid) returns void` — own `booked` booking only; `too late` when `now() > starts_at − interval '6 hours'`.
- Produces (TS, `booking.ts`):
  - `bookStudioSession(db, sessionId): Promise<{ ok: true; cardId: string | null } | { ok: false; message: string }>`
  - `cancelStudioBooking(db, bookingId): Promise<{ ok: true } | { ok: false; message: string }>`
  - `interface StudioCard { id; kind: CardKind; visits; startsOn; endsOn; usedBefore; adjusted; booked; remaining; voided: boolean }`
  - `interface MyBooking { id; sessionId; title; startsAt; cardId: string | null; canCancel: boolean }`
  - `loadMyStudio(db, userId, now?): Promise<{ cards: StudioCard[]; current: StudioCard | null; upcoming: MyBooking[]; past: MyBooking[] }>` — `current` = the card `studio_pick_card` would use today, else the latest non-voided one; `past` = last 30.

- [ ] **Step 1: Write the failing DB tests** (helpers: insert sessions/cards with the service client; time-shift by creating sessions relative to `Date.now()`):
  - `booking with a valid card takes one visit` → `remaining` 8 → 7, `card_id` set.
  - `booking without a card is a drop-in` → `card_id null`.
  - `expired, voided or empty cards are skipped` (three cases → each drop-in).
  - `the card ending first is used` (two valid cards).
  - `a training after the card's last day is drop-in` — card ends D, session at D+1 00:30 Sofia → drop-in; session at D 23:30 Sofia → card.
  - `full session refuses with "full"`; `second booking refuses with "already booked"`; `started` and `not open` and `session cancelled` reasons.
  - `two clients racing for the last spot`: capacity 1, `Promise.all` of two `studio_book` calls → one fulfilled, one error containing `full`; `booked` = 1.
  - `cancel at ≥ 6 h returns the visit`, `cancel inside 6 h refuses "too late"`, `cannot cancel someone else's booking` (error), `re-booking after cancel works`.
- [ ] **Step 2: Run** `pnpm test:db supabase/tests/studio-booking.test.ts` — Expected: FAIL.
- [ ] **Step 3: Write the migration, regenerate types, implement `booking.ts`.**
- [ ] **Step 4: Run** the DB test file and `pnpm test` — Expected: PASS. Reset the MFA flag.
- [ ] **Step 5: Commit** `feat(studio): booking and cancelling`

---

### Task 4: Cards (grant with drop-in move, void, adjust)

**Files:**
- Create: `supabase/migrations/20261029100200_studio_cards.sql`
- Create: `src/server/studio/cards.ts`
- Test: `supabase/tests/studio-cards.test.ts`

**Interfaces:**
- Consumes: Task 2–3.
- Produces (SQL, all `is_admin()` checked, else `42501`):
  - `studio_grant_card(p_user_id uuid, p_kind text, p_starts_on date, p_used_before int default 0) returns jsonb {card_id, moved}` — `ends_on` per Global Constraints (weeks 4/6), `visits` 8/12, `created_by = auth.uid()`; then moves that client's `booked` drop-in bookings with session Sofia date in `starts_on..ends_on`, sessions not cancelled, oldest first, up to the new card's remaining; sets `studio_client = true`.
  - `studio_void_card(p_card_id uuid) returns void` — reason `card in use` if any `booked` booking references it.
  - `studio_adjust_card(p_card_id uuid, p_delta int, p_reason text) returns void` — reason `negative` if remaining would drop below 0.
- Produces (TS, `cards.ts`):
  - `grantCardSchema` (zod: `userId` uuid, `kind` CardKind, `startsOn` ISO date, `usedBefore` int 0..visits−1 — message „Използваните са повече от посещенията на картата“)
  - `grantStudioCard(db, raw: unknown): Promise<{ ok: true; moved: number } | { ok: false; message: string }>`
  - `voidStudioCard(db, cardId)`, `adjustStudioCard(db, raw: unknown /* {cardId, delta, reason} */)` — same result shape.
  - `interface StudioClientRow { userId; name; phone: string | null; email: string | null /* null for placeholder */; card: StudioCard | null; warning: "low" | "expiring" | null; hasLogin: boolean }`
  - `listStudioClients(db, today: string): Promise<StudioClientRow[]>` — every `studio_client` profile, sorted by name.

- [ ] **Step 1: Write the failing DB tests:**
  - `grant Карта 8 from 2026-11-03 ends 2026-11-30 with 8 visits`.
  - `notebook import: start in the past with 5 used → remaining 3`.
  - `granting moves drop-in bookings inside the range, oldest first, up to the visits` (3 drop-ins in range + 1 outside; card with 2 remaining via used_before 6 → moved 2, the oldest two; the later one and the outside one stay drop-in).
  - `void refuses "card in use" when a booking uses it; void works on an unused card and the card is then never picked`.
  - `adjust −2 with reason lowers remaining and is visible to the client`; `adjust below zero refuses "negative"`.
  - `a client cannot call grant/void/adjust` (42501).
- [ ] **Step 2: Run** `pnpm test:db supabase/tests/studio-cards.test.ts` — Expected: FAIL.
- [ ] **Step 3: Migration, types, `cards.ts`.**
- [ ] **Step 4: Run** — Expected: PASS. Reset the MFA flag.
- [ ] **Step 5: Commit** `feat(studio): punch cards`

---

### Task 5: Admin schedule and rosters

**Files:**
- Create: `supabase/migrations/20261029100300_studio_admin.sql`
- Create: `src/server/studio/admin.ts`
- Test: `supabase/tests/studio-admin.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4, `sendToUsers` from `src/server/push/send.ts`.
- Produces (SQL, admin-checked):
  - `studio_admin_add(p_session_id uuid, p_user_id uuid) returns jsonb {booking_id, card_id, over_limit}` — same card pick; ignores capacity (`over_limit` when booked ≥ capacity before insert); allowed until session end; `already booked` still applies; `source = 'admin'`.
  - `studio_admin_remove(p_booking_id uuid) returns void` — cancels regardless of time; `cancelled_by = auth.uid()`.
  - `studio_cancel_session(p_session_id uuid) returns uuid[]` — sets `cancelled_at`, cancels all `booked` bookings, returns their user ids.
  - `studio_reset_slot_sessions(p_slot_id uuid) returns void` — deletes the slot's future sessions that have no booking rows at all.
- Produces (TS, `admin.ts`):
  - `slotSchema` (zod: `weekday` 1–7, `startTime` HH:MM, `durationMin` 15–180, `title` 2–80, `capacity` 1–100, `active` boolean)
  - `saveStudioSlot(db, service, id: string | null, raw: unknown)` — insert/update, then `studio_reset_slot_sessions` (on update) and `ensureStudioSessions(service)`.
  - `listStudioSlots(db)`
  - `interface RosterEntry { bookingId; userId; name; phone; card: { kind; remaining } | null; overLimit; source }`
  - `listSessionRoster(db, sessionId): Promise<{ session: StudioSession; entries: RosterEntry[] }>`
  - `adminAddBooking(db, sessionId, userId)`, `adminRemoveBooking(db, bookingId)` — `{ ok, overLimit? } | { ok: false; message }`
  - `cancelStudioSession(db, service, sessionId, transport: PushTransport | null): Promise<{ notified: number }>` — push „Тренировката в {ден} {час} е отменена. Посещението ти е върнато.“, url `/na-myasto`.

- [ ] **Step 1: Write the failing DB tests:**
  - `admin add beyond capacity sets over_limit`; `admin add uses the card`.
  - `admin remove inside 6 h returns the visit`.
  - `cancelling a session returns every card visit and refuses new bookings with "session cancelled"` (one card booking + one drop-in → returned user ids both, card remaining restored).
  - `editing a slot replaces future empty sessions and keeps booked ones` (change time 18:00 → 19:00; an unbooked future session moves to 19:00, a booked one stays at 18:00).
  - `a client cannot call the admin RPCs` (42501).
- [ ] **Step 2: Run** `pnpm test:db supabase/tests/studio-admin.test.ts` — Expected: FAIL.
- [ ] **Step 3: Migration, types, `admin.ts`** (unit test for the cancellation push text with a fake transport in `src/server/studio/admin.test.ts`).
- [ ] **Step 4: Run** — Expected: PASS. Reset the MFA flag.
- [ ] **Step 5: Commit** `feat(studio): admin schedule, rosters and cancellations`

---

### Task 6: Joining, walk-ins and invites

**Files:**
- Create: `supabase/migrations/20261029100400_studio_invites.sql`
- Create: `src/server/studio/join.ts`, `src/server/studio/walkin.ts`, `src/server/studio/invite.ts`
- Test: `supabase/tests/studio-people.test.ts`

**Interfaces:**
- Produces (SQL): `studio_invites(token_hash text pk, user_id → profiles on delete cascade, created_by uuid, created_at, expires_at timestamptz, used_at timestamptz)`, RLS on with no policies (service role only).
- Produces (TS):
  - `studioJoinSchema` (zod: `name` 2–60 trimmed, `phone` matching the `profiles.phone` check — „Остави телефон, за да ти пише Аксения при промяна.“)
  - SQL `studio_join(p_name text, p_phone text) returns void` (security definer, own profile via `auth.uid()`): sets `name`, `phone`, `studio_client = true`. `studio_client` is **not** added to the client column grants on `profiles`.
  - `joinStudio(db, raw: unknown): Promise<{ ok: true } | { ok: false; message: string }>` — validates with `studioJoinSchema`, calls `studio_join`.
  - `createWalkIn(service, raw: unknown /* {name, phone} */): Promise<{ ok: true; userId: string } | { ok: false; message: string }>` — `auth.admin.createUser({ email: \`walkin-${randomUUID()}@${WALKIN_EMAIL_DOMAIN}\`, email_confirm: true, user_metadata: { name } })`, then profile `phone`, `studio_client = true`. Caller must have passed `requireAdmin()`.
  - `createStudioInvite(service, userId, createdBy, now?): Promise<string>` — 32 random bytes base64url; store sha256 hex; expires in 14 days; returns the token. Only for profiles whose e-mail is a placeholder.
  - `claimStudioInvite(service, token, raw: unknown /* {email, password ≥ 10} */, now?): Promise<{ ok: true; email: string } | { ok: false; message: string }>` — reasons → `invalid invite` copy; e-mail taken → „Вече има профил с този имейл. Влез от „Имам профил“.“; on success `auth.admin.updateUserById(userId, { email, password, email_confirm: true })`, `profiles.email = email`, `used_at = now`.

- [ ] **Step 1: Write the failing DB tests:**
  - `joinStudio saves name, phone and marks studio_client`; invalid phone → message.
  - `walk-in gets a placeholder e-mail and no way to sign in`.
  - `invite claim sets e-mail and password; she can then sign in and sees the card Аксения gave the walk-in profile`.
  - `a used, expired or unknown token is refused`; `an invite for a profile with a real e-mail is refused`.
  - `claiming with an e-mail that already exists is refused and the token stays unused`.
- [ ] **Step 2: Run** `pnpm test:db supabase/tests/studio-people.test.ts` — Expected: FAIL.
- [ ] **Step 3: Migration, types, the three modules.**
- [ ] **Step 4: Run** — Expected: PASS. Reset the MFA flag.
- [ ] **Step 5: Commit** `feat(studio): joining, walk-ins and invites`

---

### Task 7: Client page `/na-myasto`

**Files:**
- Create: `src/app/na-myasto/page.tsx`, `src/app/na-myasto/actions.ts`, `src/app/na-myasto/pokana/[token]/page.tsx`
- Create: `src/components/studio/schedule-list.tsx`, `src/components/studio/my-card.tsx`, `src/components/studio/join-form.tsx`, `src/components/studio/claim-form.tsx`
- Modify: `src/proxy.ts` (matcher: `"/na-myasto/:path*"`, `"/na-myasto"`), `src/app/app/layout.tsx` (redirect), `src/app/sitemap.ts` (add `/na-myasto`)
- Test: `src/components/studio/schedule-list.test.ts`, `src/components/studio/my-card.test.ts`, `src/app/app/layout` redirect covered by a unit test of a new pure helper `onboardingRedirect(profile: { onboarding_done: boolean; studio_client: boolean }): string | null` in `src/lib/onboarding/redirect.ts`

**Interfaces:**
- Consumes: `listStudioSchedule`, `ensureStudioSessions`, `bookStudioSession`, `cancelStudioBooking`, `loadMyStudio`, `joinStudio`, `claimStudioInvite`, rules from Task 1.
- Produces: server actions `bookAction(sessionId)`, `cancelAction(bookingId)`, `joinAction(form)`, `claimAction(token, form)`; `onboardingRedirect`.

Page behaviour (from the spec): public list for the next 14 days grouped by day („Вторник, 4.11“), each row title · time · „Остават N места“ / „Няма места“ / „Отменена“; signed out → „Запиши се“ opens the join form (name, phone, e-mail, password, consent line linking /terms and /privacy in a new tab, „Имам профил“ → `/login?next=/na-myasto`), after sign-up the booking she pressed is made; signed in → card block (`cardLine`, warning „Остава ти 1 посещение“ / „Картата ти изтича на 26.11“), „Пренесени от тефтера: N“ when `usedBefore > 0`, adjustments listed with reason, upcoming bookings with „Откажи“ (hidden when `!canCancel`, replaced by „Отказът е възможен до 6 часа преди началото“), past visits. Drop-in booking confirmation: „Записана си. Еднократна — плащаш 7 € на място.“ Booking inside 6 h shows „Внимание: до началото остават по-малко от 6 часа и няма да можеш да откажеш.“ before confirming. No install prompt, no bottom nav of the club.

- [ ] **Step 1: Write the failing tests:**
  - `onboardingRedirect`: `{onboarding_done:false, studio_client:true}` → `"/na-myasto"`; `{false,false}` → `"/start"`; `{true, any}` → `null`.
  - `ScheduleList` renders „Остават 3 места“, „Няма места“ (button disabled), „Отменена“.
  - `MyCard` renders the exact `cardLine`, „Пренесени от тефтера: 5“, and the low warning.
- [ ] **Step 2: Run** `pnpm test src/components/studio src/lib/onboarding` — Expected: FAIL.
- [ ] **Step 3: Implement** the helper, components, page, actions; use `onboardingRedirect` in `AppGate` (select `studio_client` too).
- [ ] **Step 4: Run** `pnpm test`, `pnpm typecheck`, `pnpm lint` — Expected: all pass. Then in the browser preview (`fit-platform-dev`, port 3120) with a local slot: sign up a new test client at `/na-myasto`, book, see the card/drop-in line, cancel; confirm `/login` → lands on `/na-myasto`. Screenshot.
- [ ] **Step 5: Commit** `feat(studio): client booking page`

---

### Task 8: Admin section „На място“

**Files:**
- Create: `src/app/admin/(panel)/na-myasto/page.tsx` (tabs via `?tab=grafik|trenirovki|klientki`, default `trenirovki`), `.../na-myasto/actions.ts`, `.../na-myasto/[sessionId]/page.tsx` (roster), `.../na-myasto/klientka/[userId]/page.tsx` (cards, adjust, void, invite link)
- Create: `src/components/admin/studio/*.tsx` as needed (slot form, roster add search, grant form, adjust form)
- Modify: `src/components/admin/admin-nav.tsx` (item `{ href: "/admin/na-myasto", label: "На място" }` after „На живо“), `src/app/admin/(panel)/clients/[id]/page.tsx` (block „На място“ with current card line and link to `.../na-myasto/klientka/[id]`)
- Test: `src/components/admin/studio/*.test.ts` for the pieces with logic (grant form preview text „Валидна до 30.11 · остават 3“ computed from `cardEndsOn` and used-before; roster row shows „Карта 8 · остават 5“ / „7 € на място“ / „над лимита“)

**Interfaces:**
- Consumes: everything in `src/server/studio/*`, `requireAdmin`, `createAdminSupabaseClient` (service actions only after `requireAdmin()`).

Behaviour (from the spec): **График** — list of slots + form (ден, час, продължителност, заглавие, места, активен). **Тренировки** — next 14 days with booked/capacity; open → roster; „Добави“ searches existing studio clients by name/phone, or „Нова клиентка“ (име + телефон → `createWalkIn` then add); „Премахни“ per row; „Отмени тренировката“ with a confirm. **Клиентки** — `listStudioClients` with warning highlight; „Дай карта“ (Карта 8/12, начална дата default today, „вече използвани“ default 0) → toast „Картата е дадена. Преместени записвания: N.“; client page: „Коригирай“ (± and reason), „Анулирай“ (confirm), „Покана“ (only when `!hasLogin`) → shows the link `https://iamstrong.bg/na-myasto/pokana/<token>` with a copy button.

- [ ] **Step 1: Write the failing component tests** listed above.
- [ ] **Step 2: Run** `pnpm test src/components/admin/studio` — Expected: FAIL.
- [ ] **Step 3: Implement** pages, actions, nav item, client-detail block.
- [ ] **Step 4: Run** `pnpm test`, `pnpm typecheck`, `pnpm lint` — PASS; in the preview as admin: create a slot, see sessions, add a walk-in over the limit, grant a card with used-before, get an invite link, open it signed out and claim it. Screenshot.
- [ ] **Step 5: Commit** `feat(studio): admin section`

---

### Task 9: Keep the online club clean + card warnings

**Files:**
- Create: `supabase/migrations/20261029100500_studio_reports.sql`
- Create: `src/server/studio/warnings.ts`
- Modify: `src/server/admin/clients.ts` (`ClientRow.studioOnly`), `src/server/admin/risk.ts` (filter), `src/app/admin/(panel)/activity/page.tsx` (filter), `src/app/admin/(panel)/clients/page.tsx` (badge „На място“), `src/server/push/send.ts` (`sendToUsers(..., opts?: { exclude?: ReadonlySet<string> })`), `src/server/push/broadcast.ts` and `src/server/push/jobs.ts` (`sendReminders` — pass the exclude set), `src/app/api/cron/push/route.ts` (call `sendStudioWarnings`)
- Test: `supabase/tests/studio-reports.test.ts`, `src/server/studio/warnings.test.ts`, extend `src/server/push/broadcast.test.ts`

**Interfaces:**
- Produces (SQL): `admin_client_stats` re-created (drop + create, same arguments) with an extra trailing column `studio_only boolean` before `total_count`; `admin_dashboard` member counts exclude `studio_client and not onboarding_done`.
- Produces (TS): `studioOnlyUserIds(service): Promise<Set<string>>`; `sendStudioWarnings(service, transport, today: string): Promise<{ low: number; expiring: number }>` — per card with `cardWarning` = low and `warned_low_at is null` → push „Остава ти 1 посещение по картата. Поднови я при Аксения.“; expiring and `warned_expiry_at is null` → „Картата ти изтича на 26.11. Остават ти N посещения.“; both url `/na-myasto`; stamps the column so each goes once.

- [ ] **Step 1: Write the failing tests:**
  - DB: `admin_client_stats marks in-person-only clients`; `dashboard counts leave them out` (count before/after adding one).
  - Unit: `listAtRisk drops studioOnly clients`; `sendBroadcast skips excluded users` (fake transport receives no call for them); `sendStudioWarnings sends low once` (second call sends 0) and the exact texts.
- [ ] **Step 2: Run** the three test files — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `pnpm lint` — PASS. Reset the MFA flag.
- [ ] **Step 5: Commit** `feat(studio): keep online reports clean, card warnings`

---

### Task 10: Legal texts and rollout

**Files:**
- Modify: `src/lib/legal/terms.ts`, `src/lib/legal/privacy.ts`, `src/lib/legal/legal.test.ts`, `updated: "29.10.2026"` in both

**Exact copy.** Terms — new section after „8. Подаръчни ваучери“ (renumber the rest):

„9. Тренировки на място“
- „Записването за тренировките в залата става на iamstrong.bg/na-myasto. Плащането е на място, в брой или по банков път.“
- „Карта 8 дава 8 посещения за 4 седмици, Карта 12 — 12 посещения за 6 седмици, от деня, в който картата е дадена. Неизползваните посещения изтичат с картата.“
- „Посещението се отчита при записването. Можеш да откажеш до 6 часа преди началото и посещението ти се връща. При по-късен отказ или неявяване посещението се отчита.“
- „Ако нямаш карта, записването е за еднократна тренировка, която плащаш на място.“
- „Ако отменим тренировка, посещението ти се връща.“

Privacy — section 2 gets the bullet: „Тренировки на място: записвания, посещения, карти и корекции по тях, както и името и телефона, които си дала на треньора.“

- [ ] **Step 1: Write the failing test** in `legal.test.ts`: TERMS has a heading „9. Тренировки на място“ containing „6 часа“; PRIVACY section 2 mentions „Тренировки на място“.
- [ ] **Step 2: Run** `pnpm test src/lib/legal` — FAIL.
- [ ] **Step 3: Edit the texts.**
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm lint && pnpm build` — PASS.
- [ ] **Step 5: Commit** `feat(studio): legal texts`. Then give the owner one command for the hosted migration + deploy: `cd /Users/macbookpro/Downloads/cloude-c/fit-platform && pnpm exec supabase db push && npx vercel deploy --prod --yes`, and after it verify live through the public IP (`--resolve iamstrong.bg:443:$(dig +short @1.1.1.1 iamstrong.bg|tail -1)`): `/na-myasto` returns 200 and shows the schedule heading.
