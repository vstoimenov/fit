# Gift voucher — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans) by the session controller.

**Goal:** Sell gift vouchers on `/podari` (Stripe one-time payment), e-mail a code + printable card, let members redeem the code for months of access, and let the owner issue free vouchers and see every voucher.

**Spec:** `docs/superpowers/specs/2026-10-27-fit-platform-gift-voucher-design.md`.

## Global Constraints
- Prices come from `GIFT_OPTIONS` (`src/lib/site/gift.ts`); the server never trusts an amount from the client.
- Codes generated server-side with `crypto.getRandomValues`, alphabet without 0/O/1/I; normalised on input (case, dashes, spaces).
- Redemption and issuing are security-definer RPCs with `search_path = ''`; members have no direct grants on `gift_vouchers`.
- Stripe optional: without keys `/podari` keeps „Скоро“; webhook idempotent per session id.
- Tests first: DB (RLS + RPC rules), unit (code helpers, webhook parsing, purchase apply with fakes), browser for the pages.

## Tasks
1. **Code helpers** `src/lib/gift/code.ts` (`generateCode`, `normalizeCode`, `formatCode`) + tests.
2. **DB** `20261027120000_gift_vouchers.sql` + `supabase/tests/gift.test.ts`: table, RLS, `redeem_gift_voucher(p_code)`, `issue_gift_voucher(p_months, p_recipient, p_note)`.
3. **Purchase (Stripe prep)** provider `createGiftCheckout`, webhook recognises the gift session, `applyGiftPurchase` (insert once by session id, e-mail buyer) + unit tests; `/podari` form + action; `/podari/blagodarya` with status polling (`/api/gift/status`).
4. **Card** `/podari/karta/[code]` (print-friendly) + `/api/gift/[code]/card` PNG.
5. **Redeem** `/app/plan` form + action `redeemGiftAction`; messages for invalid/expired/used/active-paid.
6. **Admin** `/admin/vouchers` list + issue form, nav „Ваучери“; README notes.
7. Verify in the browser (podari form state without Stripe, card page, redeem flow with a manual voucher, admin), commit, deploy after the owner applies migrations.

## Ledger
- Tasks 1–2 complete (f2adb92): code helpers 3/3, migration + RPCs, DB tests 5/5.
- Tasks 3–6 complete (fd74abb): purchase schema/parser/apply 7/7, Stripe `createGiftCheckout` (inline `price_data`, `mode: payment`), webhook gift branch, `/podari` form (shown only with Stripe keys), `/podari/blagodarya` polling, printable card + PNG, `/app/plan` redeem form, `/admin/vouchers`; browser-checked: card page, admin list, podari copy.
- Ruling: the card page is public and keyed only by the code (the buyer's secret) with `noindex`. Cost if wrong: a leaked code shows the card (no buyer e-mail on it).
- Ruling: a live Stripe subscription blocks redemption and keeps the code (no attempt to extend Stripe billing). Cost if wrong: she redeems later; nothing lost.
- Not verified: a real Stripe Checkout + webhook round trip (no keys); covered by the parser/apply unit tests and the existing webhook plumbing.
- Final review (Opus): 2 Critical, 6 Important, 11 Minor. Fix pass (one commit), tests first where a unit exists:
  - Critical: `next build` failed on `/podari/karta/[code]` (request data outside Suspense) and `/podari/blagodarya` (`useSearchParams` outside Suspense) — both wrapped per the project pattern; `pnpm build` exit 0 (karta = partial prerender, blagodarya static).
  - Critical: README webhook step now lists `checkout.session.completed` + `checkout.session.async_payment_succeeded`.
  - redeem RPC carries the current `admin_grant_manual` guards (open paid sub → P0003, liveness re-check on the locked row); DB tests: past_due-beyond-grace refused and code untouched, ended Stripe sub converts.
  - converting to a paid plan keeps the prepaid months: `trialEndFor` → Stripe `subscription_data.trial_end` (≥48 h, ≤730 d); unit tests.
  - card PNG rendered (template-literal text nodes); curl: 200, image/png 1200×1600, 85 KB.
  - Stripe v23: `allowed_payment_method_types: ["card"]` (the SDK dropped `payment_method_types`); the parser also accepts the async success event.
  - option cards select their own period (`PickGift`), forms keep typed values after an error, honest thank-you copy (payment pending until confirmed), 400 stops polling, gifts always use Stripe regardless of the active plan provider.
  - `voided_at` + `void_gift_voucher` + admin „Анулирай“ for unredeemed vouchers (DB test); UNAUTHORIZED message on redeem; a11y (`aria-invalid`/`describedby`, focus on success); spec wording fixed.
- Final: minor (deferred): unknown card codes answer HTTP 200 with the 404 body (notFound after the streamed shell, like other dynamic pages); redeemed_by not shown in the admin list; list capped at 200 without search; no redeem form for a paying member (she is redirected from /app/plan); Cyrillic look-alike letters in codes are stripped, not mapped; no unit test for the webhook gift branch ordering.
- Final: Ruling: no `charge.refunded` handling — the owner voids by hand after a refund. Cost if wrong: a refunded voucher stays valid until she presses „Анулирай“.
- Browser-verified after the pass: card page and PNG via curl; PickGift and the order form need Stripe keys to appear (not checked live).
