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

## Phase 2 — Challenges (detailed 2026-10-25; owner approved the outline, details are the controller's calls)

### Admin „Предизвикателства“ (`/admin/challenges`)
- Fields: title (3–80), description (Markdown, ≤ 4 000, same renderer as articles), start date (Sofia date), number of
  days N (3–60), a task per day (1–200 chars) with an optional workout per day (any published workout), published.
- Start date and N cannot change once anyone has joined (the form shows them read-only with „Вече има участнички“);
  task texts and workouts stay editable. A challenge with participants cannot be deleted, only unpublished.
- „Шаблон: Първите 14 дни“ button pre-fills a new draft with 14 suggested tasks (the owner edits and publishes).
- List: title, dates, days, participants, published. Audit trigger like other admin tables.

### Member
- `/app/challenges`: running and upcoming published challenges plus the ones she joined (finished ones under
  „Завършени“). Card: title, „Ден 3 от 14“ or „Започва на 1 ноем.“, participants count, her progress bar.
- `/app/challenges/[id]`: description, „Включи се“ (primary; while the challenge has not ended), today's task with a
  check button, the day list (each day: task, optional workout link, done/not done; future days locked).
- Ticking: only today and yesterday (Sofia) can be ticked — a one-day catch-up, no back-filling of older days
  (anti-farming). Unticking is allowed for the same two days. Each first tick of a day earns 5 points
  (`points_ledger` source `challenge`, ref `challengeId:day`); unticking does not claw points back.
- Leaderboard (top 10 by ticked days, ties by the earlier last tick): first name + initial („Мария П.“); her own place
  is shown even outside the top 10. A toggle „Покажи ме в класацията“ (default on) on the detail page hides her name
  as „Участничка“ for others.
- Finished (all N days ticked): „Завърши предизвикателството!“ with a share button reusing the existing share pattern
  (image with title, days and the I AM STRONG badge).
- Начало: a card for the joined running challenge: „Ден X от N · {today's task}“ with the tick button; nothing when
  none. Nav: `/app/challenges/**` counts as Начало.
- Access: everything requires `my_access()`; without it the pages show the plan CTA.

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
