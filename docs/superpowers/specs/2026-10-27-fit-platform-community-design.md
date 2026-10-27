# Phase 4 — Community — design (builder's calls on the approved outline)

**Outline (approved, engagement spec):** feed of posts (text, optional one photo in Storage), comments, hearts; „Сподели в общността“ from the after-workout screen; report button; admin hide/delete; visible only to members with access; first name + initial shown; points per the caps (post 3, comment 1, combined 5/day); „Общност“ tab; Начало shows the two latest posts.

**Intent.** Members see each other, cheer each other and post the small wins that keep them coming back. Nothing here is public: only members with access read or write, names are first name + initial, and the owner can hide or delete anything.

**Rules**
- Post: text 1–1000 chars, optional one JPEG (re-encoded in the browser like progress photos, ≤1600 px, no EXIF) in the private bucket `community-photos` at `{user_id}/{uuid}.jpg`; optionally linked to a completion („Завърших …“). At most 5 posts per member per day.
- Comment: text 1–500 chars; at most 30 per member per day.
- Heart: one per member per post, toggleable; counts shown.
- Report: on a post or a comment, with a short reason; the owner sees reports in the admin with the content and can hide (reversible) or delete.
- Visibility: `my_access()` members and admins read non-hidden posts/comments; the author still sees her own hidden post marked „скрит“; authors can delete their own posts/comments; admins hide/unhide/delete anything.
- Points: a post earns 3, a comment 1, combined community points capped at 5 per Sofia day; the cap is enforced in the award trigger (partial award up to the cap, never more). Deleting content does not claw back points.
- Names: `first name + initial` from `profiles.name` („Мария П.“), through security-definer reads (profiles are private under RLS).
- Photos: signed URLs (1 hour) generated server-side for members with access; the storage policies allow upload only to her own folder and reading only with access.

**Non-goals.** DMs, mentions, notifications for hearts/comments (push for community comes with a later automation stage), editing posts (delete + repost), threads deeper than one level, moderation by members beyond reporting.

**Parts**
- DB: `community_posts`, `community_comments`, `community_hearts`, `community_reports`; bucket `community-photos`; RPCs `create_post`, `create_comment`, `toggle_heart`, `report_content`, `admin_moderate_post(p_id, p_hidden)`, `admin_moderate_comment(p_id, p_hidden)`; read RPCs `community_feed(p_before, p_limit)` and `community_post(p_id)` returning rows with `author_name`, counts and `hearted_by_me`; award trigger with the daily cap.
- Server: `src/server/community/{feed,write,admin}.ts`; `src/lib/community/{name,relative-time,limits}.ts` pure helpers.
- Member UI: `/app/community` (composer, feed, „Още“), `/app/community/[id]` (post, comments, comment form, report, delete own), „Общност“ tab (bar + sidebar; „Хранене“ stays reachable from Начало and Профил per the spec's final navigation), after-workout „Сподели в общността“, Начало „От общността“ (two latest posts), „Полезно“ community card points inside.
- Admin: `/admin/community` — open reports with context (hide/unhide/delete/dismiss), latest posts; nav „Общност“.
