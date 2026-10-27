# Gift voucher — design

**Intent.** `/podari` already shows three gift options (1 month €29, 3 months €79, 12 months €257) with „Скоро“. This makes them real: someone buys a voucher for a friend, gets a code and a printable card by e-mail; the friend redeems the code in the app and gets the months. The owner can also hand out free vouchers (giveaways, apologies) from the admin.

**Who does what**
- **Buyer** (no account needed): picks an option on `/podari`, enters her e-mail (+ optional recipient name and a short message), pays by card in Stripe Checkout (one-time payment, `mode: payment`, inline `price_data` — no Stripe products to pre-create). Back on `/podari/blagodarya` she sees the code immediately; the same code and a link to the printable card go to her e-mail.
- **Recipient** (member, signed in): enters the code on `/app/plan` → „Активирай“ → her access is extended by the voucher's months. If she has no account yet, the card tells her to register at iamstrong.bg/start first.
- **Owner**: `/admin/vouchers` lists every voucher (code, months, buyer, bought/issued when, redeemed by/when, status) and issues free ones (kind `manual`, with a note).

**Rules**
- A code is 10 characters from an unambiguous alphabet (`IAM-XXXXX-XXXXX` shown with dashes, stored without), generated server-side, unique. The owner can void an unredeemed one (refund, mistake).
- A voucher is valid 12 months from purchase; one redemption only; the redeemer must be signed in.
- Redemption grants access through the existing `subscriptions` row with `provider = 'manual'`: if she has no live paid subscription, `current_period_end` becomes `max(now, existing manual end) + months`, `status = 'active'`. If she has a live Stripe subscription the code is **not** consumed and she is told to redeem it after the subscription ends (no attempt to extend Stripe billing).
- Payment is confirmed only by the Stripe webhook (`checkout.session.completed`, `metadata.kind = gift`), stored once per session id — a refreshed thank-you page never creates a second voucher. The thank-you page polls for the voucher by session id (webhooks can lag a few seconds).
- Without Stripe keys the buy buttons stay „Скоро“; admin manual vouchers and redemption work regardless.
- Nothing about the recipient is stored beyond an optional first name and the buyer's e-mail; the printable card never shows the buyer's e-mail.

**Non-goals.** Refunds from the admin (Stripe dashboard); partial redemption; voucher resale protection beyond uniqueness; Revolut.

**Parts**
- DB: `gift_vouchers(id, code unique, months, amount_cents, currency, kind 'stripe'|'manual', buyer_email, recipient_name, message, stripe_session_id unique, issued_by, note, created_at, expires_at, redeemed_by, redeemed_at)`; RLS: admin select; members nothing (redemption through a security-definer RPC); `redeem_gift_voucher(p_code)` returns the new period end; `issue_gift_voucher(...)` for the admin (security definer, checks `is_admin()`); service role inserts paid vouchers.
- Server: `src/lib/gift/code.ts` (generate/normalise/format, pure), `src/server/gift/{purchase,redeem,admin,card}.ts`; Stripe provider gains `createGiftCheckout` and the webhook parser recognises the gift session; `applyGiftPurchase` writes the voucher and e-mails the buyer.
- Pages: `/podari` buy form per option (e-mail, recipient name, message) → action `startGiftCheckout`; `/podari/blagodarya?session_id=` (polls `/api/gift/status?session_id=`); `/podari/karta/[code]` printable card (print CSS) + `/api/gift/[code]/card` (ImageResponse 1200×1600 portrait); `/app/plan` redeem form; `/admin/vouchers`.
- E-mail: buyer gets code + card link; recipient gets nothing from us (the buyer hands over the card).
