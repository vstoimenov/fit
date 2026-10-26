# Public Home Page, Routes, Logo & Lead Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give iamstrong.bg a public home page at `/` (magazine direction, interactive, brand-book styled), move the founders landing to `/osnovatelki`, send signed-in members straight to `/app`, introduce the new handwritten logo, unlock the free workout against name + e-mail (leads), and add the `/podari` gift-voucher showcase.

**Architecture:** `/` is a statically prerendered Next 16 page composed of section components under `src/components/site/`; the few pieces of data it needs (free workout, trainer/Instagram links, plans) come from `"use cache"` server functions that read through anon-safe `security definer` RPCs — never the service role. Interactivity is client components using `motion` + IntersectionObserver with `useReducedMotion`. Lead capture is a server action → `submit_lead` RPC (upsert, IP rate limit) → optional Brevo contact + transactional e-mail. Pure logic (situations, time plan, FAQ, gift options, savings) lives in `src/lib/site/` with unit tests.

**Tech Stack:** Next.js 16 (cacheComponents, `"use cache"`, `cacheLife`), React 19, Tailwind v4 tokens in `globals.css`, `motion`, `next/font/google` (`Manrope`, `Bad_Script`), Supabase (migrations, RLS, security-definer RPCs, DB tests via `pnpm test:db`), zod, vitest, Brevo REST.

**Spec:** `docs/superpowers/specs/2026-10-26-fit-platform-home-design.md`

## Global Constraints

- Brand: Manrope only (headings 800, −0.03em, line-height ≤ 1.05); Bad Script only in the `Logo` and ≤ 3 handwritten accents on `/`; no gradients, no shadows; on powder (`#E5A9AE`) only ink text; one pink accent per screen.
- Tokens already in `src/app/globals.css`: `ink`, `ink-soft`, `line`, `sand`, `powder`, `powder-light`, `powder-chip`, `rose-deep`, `white`. Use them (`bg-sand`, `text-rose-deep`, …); do not add hex values in components.
- Animations: `motion` + `useReducedMotion`; ≤ 600 ms; only `opacity`/`transform`; nothing blocks scroll; no autoplay media.
- No testimonials, member counts, ratings or any number we cannot prove.
- Public pages never use the service-role client; anon reads go through `security definer` functions with `set search_path = ''`, `revoke … from public`, explicit `grant execute` to `anon, authenticated`.
- Copy is Bulgarian, exactly as in the spec's „Копи“ section; code, commits and identifiers are English.
- Base prices: Месечен 2900, Годишен 25700 (EUR cents). Gift options 2900 / 7900 (regular 8700) / 25700.
- Founders link visible while `now < 2026-11-22T00:00:00+02:00`.
- Lead rules: name 2–60 chars, valid e-mail (trimmed, lower-cased, unique), honeypot field `website` must be empty, > 10 inserts per `ip_hash` per hour → refused, marketing consent optional and unchecked by default.
- Every task ends with `pnpm typecheck && pnpm lint && pnpm test` green (plus `pnpm test:db` for DB tasks) and a commit on branch `site-home`.
- Local checks: dev server `fit-platform-dev` (port 3120), local Supabase (`pnpm db:start`), demo member via `http://localhost:3120/dev/login?as=client`, admin via `?as=admin`.

## Review Focus

1. **E-mail casing/whitespace:** `" Maria@Example.COM "` and `maria@example.com` are the same lead → one row, updated name (Task 4 DB test + zod test).
2. **Non-YouTube free workout:** if the free workout's media is Vimeo/Bunny, the facade must still play it (uses `VideoRef.embedUrl`, not a YouTube template) (Task 5 unit test).
3. **Out-of-range slider/query values:** `timePlan(7, 9)` clamps to `10`/`6` instead of producing nonsense (Task 6 test).
4. **Plans table with 0 or 1 active plan:** pricing renders what exists; the „спестяваш“ line appears only when both plans exist and the saving is positive (Task 6 `yearlySavings` test + Task 11 render guard).
5. **Honeypot and rate limit:** a filled `website` field returns `{ ok: true }` without writing; the 11th insert from one IP within an hour fails with a friendly message (Task 4 tests).

---

### Task 1: `Logo` component with Bad Script

**Files:**
- Create: `src/components/ui/logo.tsx`
- Modify: `src/app/layout.tsx` (load `Bad_Script` next to `Manrope`, expose `--font-script`), `src/app/globals.css` (add `--font-script` to the theme block the same way `--font-manrope` is wired), `src/components/ui/auth-card.tsx:10`, `src/components/app/sidebar-nav.tsx:21`

**Interfaces:**
- Produces: `export function Logo(props: { size?: "sm" | "md" | "lg"; tone?: "ink" | "white" | "on-powder"; className?: string }): JSX.Element` — renders `<span aria-label="I AM STRONG">` containing `I AM` (Manrope 800) and a marker `<span>` with `Strong` in Bad Script. Sizes: `sm` = 16 px base, `md` = 20 px, `lg` = 28 px; marker text ≈ 1.35× base; marker radius 0.35em, padding `0 0.4em`, padding-bottom slightly larger than top so baselines align. `tone="white"` → „I AM“ white, marker powder/ink text; `tone="on-powder"` → marker ink with white text.

- [ ] **Step 1: Load the font.** In `src/app/layout.tsx` add `const script = Bad_Script({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-script" })` and put `script.variable` on `<html>` next to `sans.variable`. In `globals.css` register `--font-script` in the `@theme` block exactly like `--font-manrope` is registered (so `font-script` becomes a utility).
- [ ] **Step 2: Implement `Logo`** per the Interfaces block. Use `cn()` from `src/lib/cn.ts`.
- [ ] **Step 3: Use it.** Replace the text wordmark in `auth-card.tsx` with `<Logo size="sm" />` and in `sidebar-nav.tsx` with `<Logo size="md" />` (keep surrounding layout).
- [ ] **Step 4: Verify.** `pnpm typecheck && pnpm lint`. Open `http://localhost:3120/login` and `/app` (desktop width): the new logo renders in both tones; no layout shift in the sidebar.
- [ ] **Step 5: Commit** — `feat(site): handwritten Logo component (Bad Script) used in auth card and sidebar`.

---

### Task 2: Routes — founders landing to `/osnovatelki`, member redirect, home shell

**Files:**
- Move: `src/app/page.tsx` → `src/app/osnovatelki/page.tsx` (git mv; update its header to `<Logo size="md" />`; keep everything else; add `alternates: { canonical: "/osnovatelki" }` to its `metadata`)
- Create: `src/app/page.tsx` (new home, composed from Task 7 components — in this task a minimal version: `SiteHeader`, an `<h1>` with the three hero lines, `SiteFooter`), `src/components/site/site-header.tsx`, `src/components/site/site-footer.tsx`, `src/lib/site/founders.ts`, `src/lib/site/founders.test.ts`
- Modify: `src/lib/auth-redirect.ts`, `src/lib/auth-redirect.test.ts`

**Interfaces:**
- Produces: `export const FOUNDERS_LIVE_UNTIL = new Date("2026-11-22T00:00:00+02:00")`; `export function foundersLive(now: Date): boolean`.
- Produces: `SiteHeader(props: { showFounders: boolean })` — logo, anchor links (`#kak-raboti`, `#vatre`, `#aksenia`, `#ceni`, `#vaprosi`), optional „Основателки“ → `/osnovatelki`, „Вход“ → `/login`, „Започни“ → `/start`; transparent, turns white with a bottom line after 24 px scroll (client component with a scroll listener, passive). Mobile: logo + „Вход“ + „Меню“ button opening a full-screen list (`<dialog>` or fixed panel, Escape closes, focus trapped by using `<dialog>`).
- Produces: `SiteFooter(props: { instagramUrl: string | null })` — logo, „Аксения Михайлова · I AM STRONG“, `brand.supportEmail`, Instagram link when present, links `/terms`, `/privacy`, `/login`, `© {year}`.
- `decideAuthRedirect` keeps its signature; adds `MARKETING = ["/", "/osnovatelki"]` → with `hasSession` returns `"/app"`.

- [ ] **Step 1: Failing tests.** In `auth-redirect.test.ts` add:
```ts
it("sends signed-in visitors of the marketing pages to the app", () => {
  expect(decideAuthRedirect({ pathname: "/", search: "", hasSession: true })).toBe("/app");
  expect(decideAuthRedirect({ pathname: "/osnovatelki", search: "?utm=x", hasSession: true })).toBe("/app");
  expect(decideAuthRedirect({ pathname: "/podari", search: "", hasSession: true })).toBeNull();
  expect(decideAuthRedirect({ pathname: "/", search: "", hasSession: false })).toBeNull();
});
```
In `founders.test.ts`: `foundersLive(new Date("2026-11-21T23:00:00+02:00"))` is `true`, `foundersLive(new Date("2026-11-22T00:00:01+02:00"))` is `false`.
- [ ] **Step 2: Run** `pnpm test src/lib/auth-redirect.test.ts src/lib/site/founders.test.ts` → FAIL.
- [ ] **Step 3: Implement** `MARKETING` in `auth-redirect.ts`, `founders.ts`, move the landing with `git mv`, write `SiteHeader`, `SiteFooter`, and the minimal `src/app/page.tsx` (`export const metadata` with the spec's title/description; `<SiteHeader showFounders={foundersLive(new Date())} />` is fine here because the page is prerendered at build and the flag only needs day precision — add a comment saying so).
- [ ] **Step 4: Run tests** → PASS. `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Manual check.** Signed out: `/` shows the shell, `/osnovatelki` shows the old landing unchanged. Signed in (`/dev/login?as=client` first): `/` and `/osnovatelki` land on `/app`; `/podari` would not (404 for now is fine).
- [ ] **Step 6: Commit** — `feat(site): move founders landing to /osnovatelki, redirect members to /app, home shell`.

---

### Task 3: Migration — base prices, public site links, public free workout, admin fields

**Files:**
- Create: `supabase/migrations/20261026120000_base_prices.sql`, `supabase/migrations/20261026120100_site_public.sql`, `supabase/tests/site-public.test.ts`
- Modify: `supabase/seed.sql:2-4` (1990→2900, 14900→25700), `src/lib/admin/settings.ts` (keys `trainer_video_url`, `instagram_url`, same zod shape as `community_url`, defaults `""`), `src/app/admin/(panel)/settings/actions.ts` (`saveSiteLinksAction` saving both keys), `src/app/admin/(panel)/settings/forms.tsx` (a „Сайт“ card with the two inputs, modelled on the community block at lines ~197–210), `src/lib/supabase/database.types.ts` (regenerate)

**Interfaces:**
- Produces SQL: `public.public_site_links() returns jsonb` — `{"trainer_video_url": text|null, "instagram_url": text|null}`, values only when they start with `https://`; `stable security definer set search_path = ''`; `revoke execute … from public; grant execute … to anon, authenticated`.
- Produces SQL: `public.public_free_workout() returns table (id uuid, title text, duration_min int, thumbnail_url text, video_url text)` — the single `workouts.kind = 'free'` row joined to `workout_media` (`order by created_at limit 1`); same grants.
- `20261026120000_base_prices.sql`: `update public.plans set price_cents = 2900 where name = 'Месечен' and interval = 'month' and active; update … 25700 where name = 'Годишен' and interval = 'year' and active;`

- [ ] **Step 1: Failing DB tests** in `supabase/tests/site-public.test.ts` (helpers: `adminClient`, `anonClient`, `freeWorkoutId`):
```ts
it("anon can read the free workout through the function only", async () => {
  const anon = anonClient();
  const { data } = await anon.rpc("public_free_workout");
  expect(data?.[0]?.title).toBe("Първа тренировка: цяло тяло");
  expect(data?.[0]?.video_url).toMatch(/^https:\/\//);
  const direct = await anon.from("workouts").select("id").eq("kind", "free");
  expect(direct.data).toEqual([]);
});
it("anon gets only https site links", async () => {
  const admin = adminClient();
  await admin.from("settings").upsert({ key: "instagram_url", value: "https://instagram.com/iamstrong" });
  await admin.from("settings").upsert({ key: "trainer_video_url", value: "http://insecure" });
  const { data } = await anonClient().rpc("public_site_links");
  expect(data).toEqual({ instagram_url: "https://instagram.com/iamstrong", trainer_video_url: null });
  const direct = await anonClient().from("settings").select("key");
  expect(direct.data).toEqual([]);
});
it("base prices are 29 / 257", async () => {
  const { data } = await adminClient().from("plans").select("name, price_cents").eq("active", true).order("sort");
  expect(data).toEqual([{ name: "Месечен", price_cents: 2900 }, { name: "Годишен", price_cents: 25700 }]);
});
```
- [ ] **Step 2: Run** `pnpm test:db supabase/tests/site-public.test.ts` → FAIL (functions missing).
- [ ] **Step 3: Write both migrations**, `pnpm db:reset`, `pnpm db:types`. Add the settings keys + admin form + action.
- [ ] **Step 4: Run** the DB test → PASS; then the whole `pnpm test:db`. The local seed script leaves `security_flags.admin_mfa_required = false` for dev logins, which makes the MFA tests fail; before `test:db` run `docker exec supabase_db_fit-platform psql -U postgres -c "update public.security_flags set enabled = true where key = 'admin_mfa_required'"`, and after a `db:reset` recreate the dev accounts with `node --env-file=.env.local .superpowers/sdd/seed-accounts.mjs`.
- [ ] **Step 5: Manual check.** `/admin/settings` (as admin) shows the „Сайт“ card; saving an Instagram URL persists.
- [ ] **Step 6: Commit** — `feat(db): base prices 29/257, public_site_links(), public_free_workout(), admin site links`.

---

### Task 4: Leads — table, `submit_lead`, server action, Brevo

**Files:**
- Create: `supabase/migrations/20261026120200_leads.sql`, `supabase/tests/leads.test.ts`, `src/server/leads/schema.ts`, `src/server/leads/schema.test.ts`, `src/server/leads/submit.ts`, `src/server/leads/submit.test.ts`, `src/server/leads/brevo.ts`, `src/server/leads/brevo.test.ts`, `src/server/leads/action.ts`
- Modify: `src/lib/env-schema.ts` (`LEADS_SALT: z.string().min(16)` required; `BREVO_LEADS_LIST_ID: optionalFromEnv(z.string().regex(/^\d+$/))`), `src/lib/env-schema.test.ts`, `.env.example` (document both), `.env.local` (add a local `LEADS_SALT`), `src/lib/supabase/database.types.ts` (regenerate)

**Interfaces:**
- SQL table `public.leads`: `id uuid pk default gen_random_uuid()`, `name text not null`, `email citext not null unique` (enable `citext` if not already), `marketing_consent_at timestamptz null`, `source text not null`, `ip_hash text null`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`; index `(ip_hash, created_at)`. RLS enabled; `leads_admin_select for select to authenticated using ((select public.is_admin()))`; no insert/update/delete policies; `audit_row` trigger like other admin tables.
- SQL `public.submit_lead(p_name text, p_email text, p_marketing boolean, p_source text, p_ip_hash text) returns void` — `security definer set search_path = ''`; raises `'rate_limited'` (`using errcode = 'P0001'`) when `count(*) from public.leads where ip_hash = p_ip_hash and created_at > now() - interval '1 hour' >= 10`; upserts on `email` (lower/trim done in SQL too: `lower(btrim(p_email))`), updating `name`, `source`, `updated_at`, and `marketing_consent_at = coalesce(leads.marketing_consent_at, case when p_marketing then now() end)`. Grants: revoke from public, grant to `anon, authenticated`.
- TS `leadSchema = z.object({ name: z.string().trim().min(2).max(60), email: z.email().trim().toLowerCase(), marketing: z.boolean() })`; `export type LeadInput = z.infer<typeof leadSchema>`; `export function readLeadForm(form: FormData): { kind: "honeypot" } | { kind: "input"; input: { name: unknown; email: unknown; marketing: boolean } }` — `kind: "honeypot"` when `form.get("website")` is a non-empty string; `marketing` is `form.get("marketing") === "on"`.
- `export function hashIp(ip: string | null, salt: string): string | null` (sha256 hex, null when no ip).
- `export async function submitLead(db: TypedClient, input: LeadInput, ipHash: string | null, source: "free-workout"): Promise<{ ok: true } | { ok: false; error: "rate_limited" | "failed" }>` — calls the RPC; maps `rate_limited` message.
- `export async function addBrevoContact(env: { BREVO_API_KEY?: string; BREVO_LEADS_LIST_ID?: string }, lead: { email: string; name: string; marketing: boolean; source: string }, fetchImpl = fetch): Promise<{ added: boolean }>` — POST `https://api.brevo.com/v3/contacts` with `{ email, updateEnabled: true, listIds: [Number(listId)], attributes: { FIRSTNAME, SOURCE, MARKETING } }`; `{ added: false }` when not configured or on error (never throws).
- Server action `src/server/leads/action.ts` (`"use server"`): `export async function submitLeadAction(_prev: LeadState, form: FormData): Promise<LeadState>` with `type LeadState = { status: "idle" | "ok" | "error"; message?: string; name?: string }`; reads `x-forwarded-for` via `headers()`, uses the anon server client (`createServerSupabaseClient()` is fine — the RPC is callable by anon), then fire-and-forget `addBrevoContact` and `createMailer(serverEnv).send({ to, toName, subject: "Твоята безплатна тренировка", text: … `${APP_URL}/trenirovka` … })`. Honeypot: when `readLeadForm` returns `honeypot`, return `{ status: "ok", name }` without calling anything.

- [ ] **Step 1: Failing unit tests.** `schema.test.ts`: `leadSchema` trims/lower-cases e-mail and rejects a 1-char name; `readLeadForm` returns `{ kind: "honeypot" }` when `website` is `"http://spam"` and `{ kind: "input", … }` with `marketing: true` when the checkbox is `"on"`. `submit.test.ts` (fake client with `rpc` mock): maps `rate_limited` error to `{ ok: false, error: "rate_limited" }`, success to `{ ok: true }`. `brevo.test.ts` (fake fetch): posts the documented body; returns `{ added: false }` without a key. `env-schema.test.ts`: `LEADS_SALT` shorter than 16 fails; `BREVO_LEADS_LIST_ID` must be digits.
- [ ] **Step 2: Failing DB tests** in `leads.test.ts`:
```ts
it("anon upserts a lead by e-mail, case-insensitively", async () => {
  const anon = anonClient();
  await anon.rpc("submit_lead", { p_name: "Мария", p_email: " Maria@Example.COM ", p_marketing: false, p_source: "free-workout", p_ip_hash: "h1" });
  await anon.rpc("submit_lead", { p_name: "Мария Иванова", p_email: "maria@example.com", p_marketing: true, p_source: "free-workout", p_ip_hash: "h1" });
  const { data } = await adminClient().from("leads").select("name, email, marketing_consent_at").eq("email", "maria@example.com");
  expect(data).toHaveLength(1);
  expect(data![0].name).toBe("Мария Иванова");
  expect(data![0].marketing_consent_at).not.toBeNull();
  expect((await anon.from("leads").select("id")).data).toEqual([]);
});
it("refuses the 11th lead from one ip within an hour", async () => { /* 10 ok with distinct e-mails, 11th error.message contains "rate_limited" */ });
it("only admins read leads", async () => { /* signedInClient(member) → [] ; admin via createAdminUser → rows */ });
```
- [ ] **Step 3: Run** `pnpm test src/server/leads` and `pnpm test:db supabase/tests/leads.test.ts` → FAIL.
- [ ] **Step 4: Implement** migration (+ `pnpm db:reset`, `pnpm db:types`), schema, submit, brevo, action, env.
- [ ] **Step 5: Run** both suites → PASS; `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db`.
- [ ] **Step 6: Commit** — `feat(leads): leads table with submit_lead RPC, server action, Brevo contact + e-mail`.

---

### Task 5: Cached site content readers

**Files:**
- Create: `src/server/site/content.ts`, `src/server/site/map.ts`, `src/server/site/map.test.ts`

**Interfaces:**
- `export type FreeWorkout = { id: string; title: string; durationMin: number; posterSrc: string; video: VideoRef }`; `export type SiteLinks = { trainerVideo: VideoRef | null; instagramUrl: string | null }`.
- Pure (testable) mappers in `map.ts`: `mapFreeWorkout(row: { id; title; duration_min; thumbnail_url: string | null; video_url: string } | null): FreeWorkout | null` (uses `parseVideoUrl`; `posterSrc` = `thumbnail_url ?? coverPhoto("full_body").src` (`coverPhoto` from `src/lib/photos.ts`); returns `null` when the URL does not parse) and `mapSiteLinks(json: unknown): SiteLinks`.
- `content.ts` (`import "server-only"`): `getFreeWorkout()`, `getSiteLinks()`, `getPublicPlans()` — each `"use cache"` + `cacheLife("hours")`; create the anon client exactly like `fetchPublicPlans` in `src/server/content/public-plans.ts` (anon key, no cookies) and call the RPCs / reuse `fetchPublicPlans`.

- [ ] **Step 1: Failing tests** in `map.test.ts`: YouTube URL → `video.provider === "youtube"` and `embedUrl` contains `youtube-nocookie.com/embed/`; a Vimeo URL → `provider === "vimeo"` (Review Focus 2); unparseable URL → `null`; `mapSiteLinks({ instagram_url: "https://instagram.com/x", trainer_video_url: null })` → `{ instagramUrl: "https://instagram.com/x", trainerVideo: null }`; `mapSiteLinks(null)` → both null.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; typecheck/lint.
- [ ] **Step 5: Commit** — `feat(site): cached readers for free workout, site links and plans`.

---

### Task 6: Pure site logic — situations, time plan, FAQ, gift, savings

**Files:**
- Create: `src/lib/site/situations.ts` (+ `.test.ts`), `src/lib/site/time-plan.ts` (+ `.test.ts`), `src/lib/site/faq.ts` (+ `.test.ts`), `src/lib/site/gift.ts`, `src/lib/site/pricing.ts` (+ `.test.ts`)

**Interfaces:**
- `export type Situation = { id: "mother" | "long-hours" | "comeback" | "first-time"; label: string; day: string; gets: string; startsWith: string }; export const SITUATIONS: readonly Situation[]` — texts verbatim from the spec („Ситуации“).
- `export type TimePlan = { weeklyMinutes: number; workoutsPer30Days: number; length: "short" | "mid" | "long"; lengthLabel: "кратки" | "средни" | "дълги"; levelLabel: string }; export function timePlan(minutes: number, days: number): TimePlan` — clamp minutes to [10, 40] rounded to the nearest 5, days to [2, 6] integer; `length`: ≤ 15 short, 16–25 mid, ≥ 26 long; `levelLabel`: ≤ 3 → „Начинаеща“, 4–5 → „Начинаеща → Напреднала след седмица 2“, 6 → „Напреднала“; `workoutsPer30Days = Math.round(days * 30 / 7)`.
- `export const FAQ: readonly { q: string; a: string }[]` (the 8 spec questions, answers written out in full sentences from the spec's parentheses); `export function faqJsonLd(): object` (schema.org `FAQPage`).
- `export const GIFT_OPTIONS = [{ months: 1, priceCents: 2900 }, { months: 3, priceCents: 7900, regularCents: 8700 }, { months: 12, priceCents: 25700 }] as const`.
- `export function yearlySavings(monthCents: number | undefined, yearCents: number | undefined): { perMonthCents: number; savesCents: number } | null` — `null` unless both given and `monthCents * 12 - yearCents > 0`; `perMonthCents = Math.round(yearCents / 12)`.

- [ ] **Step 1: Failing tests.** `situations`: 4 entries, unique ids, all fields non-empty. `time-plan`: `timePlan(20, 4)` → `{ weeklyMinutes: 80, workoutsPer30Days: 17, length: "mid", levelLabel: "Начинаеща → Напреднала след седмица 2" }`; boundaries 15→short, 16→mid, 25→mid, 26→long; `timePlan(7, 9)` → minutes 10, days 6 (`weeklyMinutes: 60`, level „Напреднала“); `timePlan(23, 3)` → minutes 25. `faq`: 8 entries; `faqJsonLd()["@type"] === "FAQPage"` with 8 `mainEntity`. `pricing`: `yearlySavings(2900, 25700)` → `{ perMonthCents: 2142, savesCents: 9100 }`; `yearlySavings(2900, undefined)` → `null`; `yearlySavings(1000, 12000)` → `null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(site): situations, time plan, FAQ, gift options and savings logic`.

---

### Task 7: Home sections I — hero, facts, situations, sticky CTA, final CTA

**Files:**
- Create: `src/components/site/hero.tsx`, `src/components/site/facts-strip.tsx`, `src/components/site/situations.tsx`, `src/components/site/sticky-cta.tsx`, `src/components/site/final-cta.tsx`, `src/components/site/reveal.tsx`
- Modify: `src/app/page.tsx` (compose)

**Interfaces:**
- `Reveal(props: { children; delay?: number; className? })` — client; `motion.div` fading/raising 12 px when ≥ 30 % visible (`whileInView`, `viewport: { once: true, amount: 0.3 }`), `transition` ≤ 0.5 s, disabled under `useReducedMotion`.
- `Hero(props: { hasFreeWorkout: boolean })` — chip, three-line H1 (third line in `bg-powder` marker, lines staggered 80 ms via `Reveal` delays), `PHOTOS.hero` with a one-time scale 1.04→1 over 1.2 s (skipped when reduced motion), lead paragraph (spec copy), buttons „Започни безплатно →“ (`/start`) and, only when `hasFreeWorkout`, „Опитай тренировка“ (`#opitay`), fine print „Първата тренировка е безплатна. Без карта.“
- `FactsStrip()` — the four facts; `overflow-x-auto snap-x` on mobile.
- `Situations()` — client; radio group (`role="radiogroup"`, arrow keys move selection) over `SITUATIONS`; detail block crossfades (`AnimatePresence`, 250 ms) showing `day` / `gets` / `startsWith` with labels „Денят ти“ / „Получаваш“ / „Започваш с“.
- `StickyCta()` — client; fixed bottom bar on `< md` with „Започни безплатно →“ and „Вход“; visible only after the hero leaves the viewport (IntersectionObserver on `#hero`) and hidden when the footer is visible; `padding-bottom: env(safe-area-inset-bottom)`.
- `FinalCta()` — ink section with the headline, white button to `/start`, handwritten note in `font-script text-powder`: „първата тренировка е без карта“.

- [ ] **Step 1: Build the components** per the Interfaces block and compose `src/app/page.tsx`: `SiteHeader` → `<main>` with `Hero` (`id="hero"`), `FactsStrip`, `Situations` (`id="za-teb"`), placeholder anchors for later sections, `FinalCta` → `SiteFooter` → `StickyCta`. `hasFreeWorkout` comes from `await getFreeWorkout()` (page stays prerenderable because the reader is `"use cache"`).
- [ ] **Step 2: Verify in the browser** (preview `fit-platform-dev`, signed out): 390 px and 1280 px; keyboard: Tab reaches the situation tiles and arrows change them; `resize_window colorScheme` irrelevant (light only). Emulate reduced motion (`javascript_tool`: `matchMedia('(prefers-reduced-motion: reduce)').matches` — if emulation is unavailable, temporarily toggle in OS settings) and confirm no transforms animate.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 4: Commit** — `feat(site): hero, facts strip, situations, sticky and final CTA`.

---

### Task 8: Try-it-now — video facade, lead form, `/trenirovka`

**Files:**
- Create: `src/components/site/video-facade.tsx`, `src/components/site/lead-form.tsx`, `src/components/site/try-workout.tsx`, `src/app/trenirovka/page.tsx`
- Modify: `src/app/page.tsx` (add `TryWorkout` with `id="opitay"`)

**Interfaces:**
- `VideoFacade(props: { video: VideoRef; posterSrc: string; title: string; durationMin?: number; locked?: boolean; onLockedClick?: () => void })` — client; poster via `next/image` + centred button „Пусни · {durationMin} мин“; on click (when not locked) swaps in `<iframe src={video.embedUrl + "&autoplay=1"} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" title={title} />` — nothing third-party loads before the click. When `locked`, the button shows a lock icon (lucide `Lock`) and calls `onLockedClick` (focuses the form).
- `LeadForm(props: { onUnlocked: (name: string) => void })` — client; `useActionState(submitLeadAction, { status: "idle" })`; fields `name`, `email`, checkbox `marketing` (unchecked, label from spec), hidden honeypot `<input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px]" />`, submit „Отключи тренировката“, helper text + `/privacy` link; on `status === "ok"` calls `onUnlocked(name)` and writes `localStorage.setItem("iamstrong.lead", "1")` (try/catch). Shows `message` on error.
- `TryWorkout(props: { workout: FreeWorkout })` — client wrapper: `unlocked` state initialised from `localStorage` in an effect; left `VideoFacade locked={!unlocked}`, right `LeadForm` or the „Готово, {име}. Пусни я.“ card; below: „Хареса ли ти? …“ + button to `/start`.
- `/trenirovka` page: `metadata = { title: "Безплатна тренировка", robots: { index: false } }`; `SiteHeader`, `VideoFacade` (never locked), button to `/start`, `SiteFooter`; `notFound()` when `getFreeWorkout()` is null.

- [ ] **Step 1: Build** the three components and the page; wire `TryWorkout` into `/` only when `getFreeWorkout()` returns a workout.
- [ ] **Step 2: Verify in the browser:** before any click `read_network_requests` shows no `youtube` host; submit with a 1-char name → inline error; valid submit → unlocked, DB row visible via `docker exec supabase_db_fit-platform psql -U postgres -c "select name,email,marketing_consent_at from leads"`; reload → still unlocked (localStorage); click „Пусни“ → iframe loads; `/trenirovka` plays without a form.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 4: Commit** — `feat(site): free workout unlock with lead form, video facade, /trenirovka`.

---

### Task 9: App screens + „Как работи“ + „Какво има вътре“

**Files:**
- Create: `public/screens/step-1.png`, `step-2.png`, `step-3.png`, `inside-workouts.png`, `inside-nutrition.png`, `inside-challenges.png` (PNG or WebP, 780 px wide, ≤ 120 KB each), `public/screens/CREDITS.md` (one line: captured from the app, demo profile), `src/components/site/phone-frame.tsx`, `src/components/site/how-it-works.tsx`, `src/components/site/inside-tabs.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `PhoneFrame(props: { src: string; alt: string; priority?: boolean })` — ink-bordered rounded frame (border 8 px, radius 40 px) around `next/image` 390×844 aspect.
- `HowItWorks()` — client; left sticky heading „Как работи“ (`lg:sticky lg:top-24`), right the three steps (spec copy, numbers in `text-rose-deep`); each step has a `PhoneFrame`; on `lg` only one frame is shown and swaps (crossfade) to the step currently ≥ 60 % visible (IntersectionObserver); below `lg` each step shows its own frame.
- `InsideTabs()` — client; `role="tablist"` with `ArrowLeft/ArrowRight` + `Home/End`; tabs Тренировки · Хранене · Предизвикателства · На живо; each panel: title, three check rows (spec copy), `PhoneFrame` (for „На живо“ use `PHOTOS.step1` as an ordinary image, not a phone frame); mobile tab row `overflow-x-auto snap-x`.

- [ ] **Step 1: Capture the screens** (controller does this when running subagent-driven): dev server up, browser `resize_window` 390×844, `navigate` to `http://localhost:3120/dev/login?as=client` once, then screenshot full viewport at: `/start` (first wizard step, **signed out** — open it before logging in), `/app` (home), `/app/progress`, `/app/library`, `/app/nutrition`, `/app/challenges`. Save each from the screenshot source path to `public/screens/*.png`; downscale/compress with `sips -Z 1560` then, if > 120 KB, `sips -s format webp` (keep the extension consistent with the file actually written and reference it accordingly).
- [ ] **Step 2: Build** the components and add them to `/` with ids `kak-raboti` and `vatre`.
- [ ] **Step 3: Verify in the browser:** scroll on desktop swaps the phone; tabs work with the keyboard; mobile layout has no horizontal page scroll.
- [ ] **Step 4:** typecheck/lint/test. **Step 5: Commit** — `feat(site): how-it-works and inside tabs with real app screens`.

---

### Task 10: Time plan, trainer, first 14 days

**Files:**
- Create: `src/components/site/time-plan.tsx`, `src/components/site/trainer.tsx`, `src/components/site/first-14.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `TimePlanCalculator()` — client; two `<input type="range">` (minutes 10–40 step 5 default 20; days 2–6 default 4) with visible values and labels; output from `timePlan()` (Task 6): „≈ {weeklyMinutes} мин. на седмица“, „≈ {workoutsPer30Days} тренировки за 30 дни“, „Твоите тренировки: {lengthLabel}“, „Ниво за старт: {levelLabel}“; button „Вземи плана си →“ → `/start?minutes=${m}&days=${d}`. Values animate with a 200 ms number tween only when motion is allowed.
- `Trainer(props: { video: VideoRef | null })` — photo `PHOTOS.step2` 4:5, label „Треньорката“, heading „Аксения Михайлова“, three paragraphs marked `{/* TODO owner copy */}` with sensible working text in first person; when `video` is non-null a button „Чуй я за 60 секунди“ opening `VideoFacade` in a `<dialog>`.
- `First14()` — client; heading „Има план от първия ден“; horizontal `snap-x` strip of 14 cards from `FIRST_14_DAYS` (import from `src/lib/challenges/template.ts`; never copy the strings); days 1, 7, 14 styled `bg-sand` with larger text; desktop prev/next buttons scroll by one card (`scrollBy` smooth, instant under reduced motion); drag-to-scroll by pointer events; caption „Предизвикателството върви във всяко членство.“

- [ ] **Step 1: Build** and add to `/` (`id="vreme"`, `id="aksenia"`, `id="14-dni"`); `Trainer` receives `(await getSiteLinks()).trainerVideo`.
- [ ] **Step 2: Verify in the browser:** sliders update text live and the CTA href carries the values; set `trainer_video_url` in `/admin/settings` to a YouTube link → after the cache window (or `pnpm dev` restart) the button appears; the 14-day strip scrolls with buttons and touch.
- [ ] **Step 3:** typecheck/lint/test. **Step 4: Commit** — `feat(site): time-plan calculator, trainer section, first-14-days strip`.

---

### Task 11: Pricing, `/podari`, FAQ, JSON-LD

**Files:**
- Create: `src/components/site/pricing.tsx`, `src/components/site/faq.tsx`, `src/components/site/json-ld.tsx`, `src/app/podari/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `Pricing(props: { plans: PublicPlan[] })` — client toggle „Месечно / Годишно“ (segmented, default Месечно; `role="radiogroup"`); cards built from `plans` by `interval` (render only those present); yearly card shows `yearlySavings()` line „≈ €{perMonth} на месец · спестяваш €{saves}“ and a „Най-изгодно“ marker chip only when the helper returns non-null; third card „Подари — от €29“ with the spec text and button „Избери подарък“ → `/podari`; plan buttons → `/start`; the two spec lines below („Във всяко членство…“, „14 дни гаранция…“). Prices via `formatPrice(cents, "EUR")` from `src/lib/format.ts`.
- `Faq()` — `<details>`/`<summary>` list from `FAQ`; summary has a rotating chevron; `id="vaprosi"`.
- `JsonLd(props: { data: object })` — `<script type="application/ld+json">` with `JSON.stringify` (escape `<` as `<`); `/` renders `Organization` (name, url `serverEnv.APP_URL`, logo `${APP_URL}/pwa-icon/512`) and `faqJsonLd()`.
- `/podari`: `metadata.title = "Подари членство"`; `SiteHeader`, heading „Подари сила.“, three cards from `GIFT_OPTIONS` (months label „1 месец“ / „3 месеца“ / „12 месеца“, price, struck-through regular price when present, the three bullet lines from the spec), button „Купи ваучер“ **disabled** with the chip „Скоро“ (same look as `plan-picker.tsx:95`) and the note „Плащанията се включват скоро.“; `SiteFooter`.

- [ ] **Step 1: Build**; add `Pricing` (`id="ceni"`) with `await getPublicPlans()`, `Faq`, `JsonLd` to `/`.
- [ ] **Step 2: Verify:** `/` shows €29,00 and €257,00 with „≈ €21,42 на месец · спестяваш €91,00“ formatted by `formatPrice`; temporarily deactivate the yearly plan in the DB → no savings line, no crash (Review Focus 4), then restore; `/podari` renders three cards with disabled buttons; `view-source` contains both JSON-LD blocks.
- [ ] **Step 3:** typecheck/lint/test. **Step 4: Commit** — `feat(site): pricing with gift card, /podari showcase, FAQ and JSON-LD`.

---

### Task 12: Admin — „Лийдове“ page, CSV export, dashboard tile

**Files:**
- Create: `src/app/admin/(panel)/leads/page.tsx`, `src/app/admin/(panel)/leads/export/route.ts`, `src/server/admin/leads.ts`, `src/server/admin/leads.test.ts`
- Modify: `src/components/admin/admin-nav.tsx` (add `{ href: "/admin/leads", label: "Лийдове" }` after „Клиентки“), `src/server/admin/dashboard.ts` (add `leads: z.object({ d7: n })` and the count), `src/app/admin/(panel)/page.tsx` (Tile „Лийдове 7 дни“)

**Interfaces:**
- `export async function listLeads(db: TypedClient, q: string | null): Promise<Lead[]>` where `Lead = { id; name; email; source; marketing_consent_at: string | null; created_at: string }`, newest first, `ilike` on e-mail when `q`.
- `export function leadsCsv(rows: Lead[]): string` — header `name,email,source,marketing,created_at`, RFC 4180 quoting, `marketing` as `yes`/`no`, UTF-8 BOM prefix so Excel opens Cyrillic correctly.
- Route `GET /admin/leads/export` → `requireAdmin()`, `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="leads-YYYY-MM-DD.csv"`.

- [ ] **Step 1: Failing test** `leads.test.ts`: `leadsCsv([{ name: 'Мария "М"', email: "m@x.bg", source: "free-workout", marketing_consent_at: null, created_at: "2026-10-26T10:00:00Z" }])` starts with `﻿name,email,source,marketing,created_at\n` and quotes the name as `"Мария ""М"""`, marketing `no`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** page (table + search form + „Експорт CSV“ link), route, nav entry, dashboard tile. **Step 4: Run** → PASS; typecheck/lint/test.
- [ ] **Step 5: Verify:** `/admin/leads` (as admin) lists the lead from Task 8; export downloads; dashboard shows „Лийдове 7 дни“.
- [ ] **Step 6: Commit** — `feat(admin): leads list, CSV export and dashboard tile`.

---

### Task 13: SEO, Open Graph image, legal placeholders, brand text, README

**Files:**
- Create: `src/app/opengraph-image.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`
- Modify: `src/lib/brand.ts` (`description: "Онлайн клуб за тренировки у дома за жени. 20 минути на ден, без зала, с Аксения Михайлова."`), `src/app/page.tsx` (`metadata.title = "I AM STRONG — тренировки у дома за 20 минути на ден"`, `openGraph` basics), `README.md` go-live checklist

**Interfaces:**
- `opengraph-image.tsx`: `ImageResponse` 1200×630, white, logo (Manrope „I AM“ + powder marker; the OG renderer cannot use `next/font` — load `manrope-800.ttf` from the same font dir `src/app/api/share/[completionId]/route.tsx` uses, and render „Strong“ in Manrope too, since Bad Script is not available there — note this in a comment), headline three lines with the powder marker.
- `sitemap.ts`: `/`, `/osnovatelki`, `/podari`, `/start`, `/login` with `serverEnv.APP_URL`. `robots.ts`: allow `/`, disallow `/app`, `/admin`, `/api`, `/dev`, `/trenirovka`; `sitemap` URL.
- `/terms`, `/privacy`: `SiteHeader` + `SiteFooter`, headings „Общи условия“ / „Политика за поверителност“, paragraph „Документът се подготвя и ще бъде публикуван преди старта на клуба.“, `robots: { index: false }`.
- README checklist additions: Meta ads must point to `/osnovatelki`; Stripe prices €29/€257 → `provider_price_ids`; `LEADS_SALT` + optional `BREVO_LEADS_LIST_ID`; owner copy for the trainer section; real photos; legal texts for `/terms`, `/privacy`; `trainer_video_url` / `instagram_url` in admin settings.

- [ ] **Step 1: Implement** all files. **Step 2: Verify:** `curl -s localhost:3120/opengraph-image | file -` reports PNG; `/sitemap.xml` and `/robots.txt` respond; `/terms`, `/privacy` render; `pnpm build` succeeds (cacheComponents must not complain about `/` — if it does, the offending read must be inside a `"use cache"` function).
- [ ] **Step 3:** typecheck/lint/test. **Step 4: Commit** — `feat(site): metadata, OG image, sitemap, robots, legal placeholders, go-live notes`.

---

### Task 14: Whole-page verification pass

**Files:** none new (fixes go to the owning files)

- [ ] **Step 1: Production build + start** (`pnpm build`, then a `next start` on a spare port) and check `/` signed out at 360, 390, 768, 1280 px: no horizontal scroll, sticky CTA appears after the hero and hides over the footer, every anchor in the header lands on its section, header turns solid after scrolling.
- [ ] **Step 2: Auth paths:** signed in → `/`, `/osnovatelki` → `/app`; `/podari`, `/trenirovka`, `/terms`, `/privacy` reachable both ways.
- [ ] **Step 3: Reduced motion:** with `prefers-reduced-motion: reduce` no element animates (hero zoom, reveals, crossfades, number tween, smooth scroll).
- [ ] **Step 4: Network hygiene:** before interacting, no request to `youtube*.com`, `brevo.com`; after unlocking + „Пусни“ exactly one YouTube iframe.
- [ ] **Step 5: Lighthouse** (Chrome DevTools in the pane or `npx -y lighthouse http://localhost:<port>/ --preset=desktop --only-categories=performance,accessibility --quiet`; mobile form factor as well): Performance ≥ 90, Accessibility 100. Fix and re-run until both hold; record the scores in the commit message.
- [ ] **Step 6:** `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db` green. **Commit** any fixes — `chore(site): verification fixes (Lighthouse mobile P/A: NN/100)`.
