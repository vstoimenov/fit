# Custom YouTube player + „Гледано" — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans) by the session controller.

**Goal:** The workout player no longer looks like YouTube (own controls and poster, YouTube chrome covered), and members can mark any workout as watched independently of the points-earning „Завърших".

**Architecture:** The player page passes a `VideoRef` (provider + id + embedUrl). For YouTube the client renders the IFrame API player with `controls=0` behind a full overlay that owns every tap: own poster/play button, bottom bar (play/pause, time, seek, mute, fullscreen), own paused/ended screens. Vimeo/Bunny keep the plain iframe. Watch time for „Завърших" counts only while the video is actually playing (tab visible). Watched marks live in a new `workout_watches` table (member-owned rows, RLS), set by a toggle in the player, automatically on video end, and by a trigger when a completion is saved; the library shows a „Гледано" badge.

**Spec:** owner's request (2026-10-27): keep YouTube for now, hide its look with our own player; a manual „Гледано" mark separate from „Завърших".

## Global Constraints
- Brand tokens only; 44 px targets; lucide icons; Bulgarian copy; reduced motion respected.
- RLS: a member reads/writes only her own rows; no new grants to anon; `search_path = ''` on functions.
- Points logic untouched: „Завърших" stays time-gated (70 % of the duration, playing + visible).
- Tests: unit (vitest) for pure helpers, DB tests for RLS and the trigger; `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db` green before deploy.

## Tasks
1. **Pure helpers** `src/lib/video/player-time.ts`: `formatClock(seconds)` → `m:ss` / `h:mm:ss`; `progressPercent(current, duration)` clamped 0–100. Tests first.
2. **DB** `supabase/migrations/20261027100000_workout_watches.sql`: table, RLS (own select/insert/delete), grants, trigger `workout_completions → workout_watches`. DB tests first (`supabase/tests/watches.test.ts`).
3. **Server** `src/server/content/watches.ts` (`setWatched`, `listWatchedIds`) + action `setWorkoutWatched` in `src/app/app/workout/[id]/actions.ts`; `getWorkoutForPlayer` returns `video: VideoRef`.
4. **Player** `src/components/workout/youtube-player.tsx` (IFrame API, overlay controls) + `player.tsx` wiring (playing-time gate, watched toggle, auto-mark on end); `WorkoutCard` badge; library passes watched ids.
5. **Verify** in the browser (mobile + desktop), commit, deploy.

## Ledger
- Task 1–2 complete: `player-time` helpers + `workout_watches` migration, RLS, trigger; unit 3/3, DB 6/6 (commit 1bebb2a).
- Task 3–4 complete: `watches.ts` service (6/6), `setWorkoutWatched` action, `getWorkoutForPlayer` → `video: VideoRef`, `YouTubePlayer`, `Player` wiring, library badge.
- Ruling: the paused/ended screens are opaque (poster + dim) rather than the frozen frame — the only way to cover YouTube's title bar and related-videos shelf. Cost if wrong: she loses the paused frame; nothing functional.
- Ruling: Vimeo/Bunny keep the plain iframe and count watch time while the tab is visible (they do not report playback). Cost if wrong: none today — every workout is on YouTube.
- Ruling (corrected): the poster keeps `preload`. The slow/never reveal of the streamed Suspense boundary was not the image: React 19.2's `$RC` reveals batched boundaries on `requestAnimationFrame`, which Chrome never fires while the Browser pane is hidden/not painting — a test-environment artefact. Verified by `$RB.length === 4` and an rAF that never fired with `visibilityState === "visible"`. Cost if wrong: none; a backgrounded tab on a real device reveals when it returns, by React's design.
- Ruling: iOS fallback — when a play call on a touch device gets no answer within 1.2 s, the centre of the poster passes one tap through to YouTube's own play button (edges stay ours so the title-bar links are unreachable). Verified only by code path; no iOS device in this session. Cost if wrong: an iPhone needs a second tap to start; nothing breaks.
- Deferred minor: the locked workout view still renders `WorkoutCover preload` inside the same Suspense boundary; check its reveal time on a device (pre-existing).
- Final review (Opus, whole branch): 1 Critical, 7 Important, 11 Minor. Fix pass in one commit:
  - fixed native-tap fallback blocked by the cover + missing edge strips — cover/surface/button `pointer-events-none` in that mode, four edge strips with a centre hole; browser-verified geometry only (no iOS device).
  - fixed tap before `onReady` throwing — `readyRef`; a tap before ready is queued and honoured on ready (browser-verified).
  - fixed API script failure → endless spinner — `onerror` + 15 s timeout reject and forget the promise; `failed` state with „Опитай пак"; 20 s ready timeout.
  - fixed keyboard users losing controls — controls stay mounted (opacity), keyboard focus pins them, any key reveals; `inert` on the hidden iframe.
  - fixed iPhone without fullscreen — CSS theatre mode when element fullscreen is unavailable; Esc exits; bar shown at the end too.
  - fixed controls never hiding after a queued play — hide timer armed on the PLAYING transition.
  - fixed GDPR export missing `workout_watches` — profile.test RED→GREEN.
  - fixed unlock threshold vs real length — `unlockThreshold` (unit RED→GREEN), real duration reported from the player.
  - also: `z.boolean()` in the action; backfill of pre-existing completions in the migration; DB tests for locked workout, foreign delete, admin read, plain-insert duplicate.
- Final: minor (deferred): watch reads throw instead of degrading (page/library) — adopt the `…OrNull` pattern.
- Final: minor (deferred): seek thumb jumps while dragging (250 ms poll overwrites); seekTo on every input event; bar hides under a resting mouse.
- Final: minor (deferred): „Гледано" toggle changes label and `aria-pressed` together — pick one.
- Final: minor (deferred): 1 s timer restarts on PLAYING↔BUFFERING flips and drops partial seconds (safe side).
- Final: minor (deferred): no component tests for `YouTubePlayer` (needs a DOM test environment + fake YT).
- Final: minor (deferred): library badges „Гледано" + long lock badge may overlap on narrow cards.
- Final: Ruling: the 70% gate stays client-side (`completeWorkout` accepts a direct call) — pre-existing, out of scope — cost if wrong: a technical member can self-complete; points only.
