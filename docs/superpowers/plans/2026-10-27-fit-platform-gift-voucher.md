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
