# Push notifications — design

**Intent.** Members asked (through the install prompt) for reminders on the phone; the owner wants to reach everyone when a new workout lands and for announcements. The PWA already registers a service worker; this adds Web Push on top of it. No native app, no third-party push service: VAPID keys we own, `web-push` on the server.

**Who gets what**
- **Reminder** („Днес още не си тренирала“): once a day at the member's chosen hour (default 18:00, her timezone), only if she has not completed a workout that day and has push on. One per day, never on a day she already trained.
- **New workout**: when a workout with `notify = true` reaches its `publish_at`, every member with push on gets „Нова тренировка: {title}“ once (`workouts.notified_at` marks it sent). Free/starter workouts included; drafts never.
- **Broadcast** from the owner: title + body + optional link, to every member with push on. Sent from `/admin/notifications`, logged with the recipient count.

**Goals.** Opt-in only; one tap to turn on from the profile; easy to turn off; nothing personal in a notification body (no health data, no names beyond her own first name); a dead subscription (410/404) is dropped automatically; everything auditable in the admin.

**Non-goals.** Per-category preferences beyond on/off + hour (later if asked). Segmented broadcasts. E-mail fallback. Rich media.

**Anti-goals.** Notifying a member who turned push off; notifying twice for one workout; sending from a cron that anyone can trigger.

**Platform notes (builder decisions).** iOS needs the app on the home screen (16.4+) — the card says so and links the install steps when `standalone` is false on iOS. Permission is requested only on the member's tap. The service worker is registered only in production builds; the card shows „недостъпно“ when `PushManager` is missing.

**Parts**
- DB: `push_subscriptions(id, user_id, endpoint unique, p256dh, auth, user_agent, created_at, last_used_at)` member-owned (RLS own select/insert/delete, admin select); `profiles.push_hour smallint` (0–23, null = reminders off; set to 18 when she subscribes); `workouts.notified_at timestamptz`; `push_sends(id, kind, title, body, url, recipients, created_by, created_at)` admin-only read, service-role write.
- Server (`src/server/push/`): `subscriptions.ts` (save/remove own), `send.ts` (`sendPush(admin, userIds, payload)` with `web-push`, prunes 404/410, returns counts), `jobs.ts` (`notifyPublishedWorkouts(admin, now)`, `sendReminders(admin, now)`), `broadcast.ts` (admin action + log).
- Cron: `vercel.json` hourly `/api/cron/push` guarded by `CRON_SECRET` (Vercel's `Authorization: Bearer`). Idempotent: reminders keyed by (user, local date) in `push_sends`? — simpler: `profiles.push_reminded_on date` updated when a reminder goes out.
- Client: `PushCard` in `/app/profile` (status, on/off, hour select, iOS hint); `public/sw.js` gains `push` + `notificationclick`.
- Admin: `/admin/notifications` (broadcast form + last 20 sends), nav item „Известия“.
- Env: `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` (mailto:info@iamstrong.bg), `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, `CRON_SECRET`. Without the keys the card says „скоро“ and nothing sends. README documents `npx web-push generate-vapid-keys`.
