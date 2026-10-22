# Fit platform (I AM STRONG) — engagement: home, points & levels, challenges, live, recipes, community

Date: 2026-10-22. Status: approved in chat ("ок") after a mock-up of the home screen; the details below are the
controller's calls, stated to the owner before approval.

## Why

The owner wants members to land on a home screen (not straight into a workout) and the features the I AM STRONG
landing promises: points and levels with rewards, challenges („Първите 14 дни“), live sessions with Аксения,
recipes, and an in-app community. Built in four phases, each reviewed and deployed before the next:

1. **Home + points & levels** (this spec's detailed part; plan `2026-10-22-fit-platform-home-points.md`)
2. Challenges
3. Live sessions + recipes
4. Community

## Navigation (final state)

Начало · Тренировки · Общност · Полезно · Профил (mobile bottom bar, desktop sidebar). „Прогрес“ leaves the bar: it is
reached from a card on Начало and from Профил (`/app/progress` stays; it counts as Профил in the nav). Until phase 4 the
bar has four tabs: Начало · Тренировки · Полезно · Профил.

## Phase 1 — Home + points & levels

### Начало (`/app`)
Replaces the „Днес“ screen. Order: date + „Здравей, {name}“; level chip „Ниво N · P т.“ with a powder bar to the next
level and „Още X точки до ниво N+1 · {reward}“ (or „Максимално ниво“); today's workout as a compact photo card with
„Започни“ (all existing today states — free first workout, starter week, regular, rest, locked, countdown, past-due
banner — keep their logic and copy); week strip + this-week and series tiles; a „Прогрес“ card linking to
`/app/progress`; the newest article for her level (from „Полезно“) when one exists. Later phases add a challenge card,
the next live session and the latest community posts. Nothing auto-starts a workout.

### Points
- Append-only ledger `points_ledger(id, user_id, source, ref, points, created_at)`, unique `(user_id, source, ref)`
  so every award is idempotent. Members read their own rows; admins read all; nobody writes from the client —
  awards come only from `security definer` triggers/functions.
- Phase 1 sources: a completed workout **10**, at most once per day (`ref` = the Sofia date of `completed_at`, so extra workouts the same day earn nothing — anti-farming), a progress check-in **5** at most once per ISO
  week (`ref` = `YYYY-Www` in Europe/Sofia). Later phases: challenge day 5, live attendance 5, community post 3 /
  comment 1 with a combined community cap of 5 points per day. An admin adjustment source exists for corrections.
- Deleting a completion or check-in does not claw points back (keeps the ledger append-only; cost: rare over-count).
- Backfill on migration: existing completions and check-ins earn their points once.

### Levels (1–10)
Thresholds (total points): 1:0 · 2:50 · 3:120 · 4:220 · 5:350 · 6:520 · 7:730 · 8:980 · 9:1270 · 10:1600. One SQL
function `level_for_points(int)` and one TS mirror pinned by a parity test. Rewards (as on the landing): 4 → 20%
отстъпка от следващия абонамент; 6 → ексклузивни тренировки; 8 → лична консултация с Аксения; 10 → 6 месеца клуб
безплатно.

### Rewards handling
- Level 6: workouts get `min_member_level smallint null` (1–10). Below it the workout appears in the library with a
  lock „Отключва се на ниво N“ and its video is not served (`can_watch` checks the level; admins unaffected).
- Levels 4, 8, 10: manual by the owner. Admin page „Награди“ lists members who reached 4/8/10 with reached date and a
  „Дадено“ toggle (`rewards_given(user_id, level, given_at, given_by, note)`); level 10 links to the existing manual
  grant (6 months). Automatic Stripe coupons come when Stripe keys exist.
- Admin client page shows points, level and the ledger (last 20). Admin can add/remove points with a reason (source
  `admin`).
- After a workout the after-workout screen shows „+10 точки“ and the new total/level; level-up gets a short
  celebration line.

## Phase 2 — Challenges (outline)
Admin creates a challenge (title, description, start date, N days, a task per day, optional workout per day). Members
join; each day they tick the task (only today and past days; not future); progress bar; leaderboard by first name +
initial; 5 points per day. Home shows the joined challenge card. „Първите 14 дни“ is the first one.

## Phase 3 — Live + recipes (outline)
Admin schedules live sessions (title, start time, Zoom/YouTube link, later a recording link). Home shows the next one
with „Добави в календара“ (.ics). Members tap „Влизам“ at start time (5 points once per session). Recordings list in
„Полезно“. Articles get a `category` (`article` | `recipe`) with a filter in „Полезно“ and in admin.

## Phase 4 — Community (outline)
Feed of posts (text, optional one photo in Storage), comments, hearts; „Сподели в общността“ from the after-workout
screen; report button; admin hide/delete; visible only to members with access; first name + initial shown; points
per the caps above. „Общност“ tab added; Home shows the two latest posts.

## Constraints
- Design rules of the redesign (tokens, Manrope, one primary per screen, 44px targets, lucide, Bulgarian copy).
- Next 16 cacheComponents page pattern; env only in `app/**`; services testable without `src/env.ts`.
- New migrations only; no schema-wide statements (the hosted DB is shared with another app); the controller applies
  migrations to the hosted project after each phase.
- Points can never be written or edited by a member; every award path is idempotent.

## Out of scope (all phases)
Automatic Stripe coupons, push notifications for live/challenges (later with the automations stage), DMs between
members, native app.
