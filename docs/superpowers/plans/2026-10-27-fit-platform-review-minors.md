# Review minors (home page + player) — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans) by the session controller.

**Goal:** Close the deferred minors from the home-page review (2026-10-26) and the player review (2026-10-27) that affect real users or operators, without changing the approved design.

**Spec:** the two ledgers — scratchpad `site-home-ledger.md` (lines "Final: minor (deferred)") and `docs/superpowers/plans/2026-10-27-fit-platform-player-watched.md`.

## Tasks (each: failing test → fix → green, where a unit is testable; pure CSS/prop tweaks verified by lint + browser)
1. Watch reads degrade instead of failing the page: `listWatchedIdsOrEmpty`, `isWatchedOrFalse` (server) + pages. Also makes a deploy before the migration safe.
2. Admin leads: `.range()` pagination (`page`, 100 per page, „Предишна/Следваща“), export walks every page; CSV unchanged.
3. Site links validated on save: trainer video through `parseVideoUrl`, Instagram must be an https instagram.com link; empty clears.
4. Brevo request gets a timeout (`AbortSignal.timeout`, 5 s).
5. Pricing period radio group: arrow keys + roving tabindex (`nextPeriod` helper).
6. Lead form: values survive a server error, the error is focused, the play button gets focus after the unlock.
7. Small a11y/perf: sticky CTA `motion-reduce`, First-14 focus rings, PhoneFrame `priority`→`preload` (no desktop-only preload on phones), time-plan live region announces the settled value only.
8. Housekeeping: `--font-script` variable name, raw hex colours → tokens/opacity, README notes (form e-mail needs Brevo env; `LEADS_SALT` on Preview too), honeypot/action tests.

## Not doing (rulings)
- Pricing stays one switching card (the owner approved the current look); the spec's two-card wording is superseded.
- Rate-limit check-then-insert stays (negligible).
- Player seek/hover/timer minors and component tests for the player stay deferred (need a DOM test environment).

## Ledger
- Tasks 1–8 complete in one commit (b1ca9e4): unit 836/836, typecheck + lint clean. Browser-verified: pricing arrow keys/Home/End with roving tabindex, lead form keeps values and focuses the error, time-plan live text, admin leads page. DB tests unaffected (no schema change).
- Ruling: `listLeads` now returns `{ rows, hasMore }` (was `Lead[]`) — the dashboard uses `countRecentLeads` only, so nothing else changed. Cost if wrong: a compile error, caught by typecheck.
- Ruling: PhoneFrame lost its preload entirely rather than switching to `preload` — the column is hidden on phones and desktop LCP is the hero. Cost if wrong: slightly later paint of the phone screen on desktop.
- Final review (Opus): 0 Critical, 1 Important, 9 Minor. Fixed: CSV export stopped at PostgREST's 1000-row cap (`listAllLeads` asked for 1001 rows) — capped-fake test RED→GREEN, export now pages by exactly 1000 with a short-page stop and a 100-page guard; `id` tie-breaker on both readers. Also done (one-liners): `aria-atomic` on the time-plan live region, modifier keys ignored by the pricing arrows, typed values capped at 60/254, lead-form error announced by focus only (no double read), trainer frame `bg-white/5`, success panel `role="status"`, duplicate import, JSDoc placement, PhoneFrame comment, `parseSiteLinks` canonical https (http upgraded), hint names Bunny.
- Final: minor (deferred): leads page past the last page shows „Още няма лийдове“ with a „Предишна“ link; huge `?page=` values make PostgREST answer 400 (admin-only).
- Final: minor (deferred): no `submitLeadAction` test (needs `headers()`/`after()` stubs); `values` contract covered by the browser check only.
- Final: minor (deferred): settings video/Instagram inputs are `type="url"`, so scheme-less pastes are blocked by the browser before `parseSiteLinks` sees them; `m.instagram.com`/`instagr.am` rejected.
- Final: Ruling: warm grey `#BDBBB4` → `white/70` stands (tokens over one-off hex; the difference is imperceptible on ink). Cost if wrong: a hair cooler grey on three dark cards.
