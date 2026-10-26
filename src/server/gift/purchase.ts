import "server-only";

import type Stripe from "stripe";
import { z } from "zod";
import { formatCode, generateCode } from "@/lib/gift/code";
import { GIFT_OPTIONS, giftMonthsLabel } from "@/lib/site/gift";
import type { TypedClient } from "@/server/db/types";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** The /podari order form. The price is never taken from the form (see `giftOption`). */
export const giftOrderSchema = z.object({
  months: z.coerce
    .number()
    .refine((m) => GIFT_OPTIONS.some((o) => o.months === m), "Избери период"),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email("Провери имейла").max(254),
  ),
  recipientName: z.preprocess(
    emptyToNull,
    z.string().trim().max(60, "До 60 знака").nullable().default(null),
  ),
  message: z.preprocess(
    emptyToNull,
    z.string().trim().max(300, "До 300 знака").nullable().default(null),
  ),
});
export type GiftOrder = z.infer<typeof giftOrderSchema>;

export function giftOption(months: number) {
  const option = GIFT_OPTIONS.find((o) => o.months === months);
  if (!option) throw new Error(`unknown gift option ${months}`);
  return option;
}

export const giftProductName = (months: number) =>
  `Подаръчен ваучер I AM STRONG · ${giftMonthsLabel(months)}`;

/** What the webhook learns from a paid gift Checkout session. */
export interface GiftPurchase {
  sessionId: string;
  months: number;
  amountCents: number;
  currency: string;
  buyerEmail: string | null;
  recipientName: string | null;
  message: string | null;
}

/** A paid `checkout.session.completed` marked `metadata.kind = gift`; null for anything else. */
export function giftFromStripeSession(event: Stripe.Event): GiftPurchase | null {
  if (event.type !== "checkout.session.completed") return null;
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.mode !== "payment" || s.payment_status !== "paid") return null;
  if (s.metadata?.kind !== "gift") return null;
  const months = Number(s.metadata.months);
  if (!GIFT_OPTIONS.some((o) => o.months === months)) return null;
  return {
    sessionId: s.id,
    months,
    amountCents: s.amount_total ?? 0,
    currency: (s.currency ?? "eur").toUpperCase(),
    buyerEmail: s.customer_details?.email ?? s.customer_email ?? null,
    recipientName: s.metadata.recipient_name?.slice(0, 60) || null,
    message: s.metadata.message?.slice(0, 300) || null,
  };
}

export const cardUrl = (appUrl: string, code: string) => `${appUrl}/podari/karta/${code}`;

/**
 * Creates the voucher for a paid session and e-mails the buyer. Idempotent: the session id is
 * unique, so a replayed webhook finds the existing code and sends nothing again.
 */
export async function applyGiftPurchase(
  admin: TypedClient,
  gift: GiftPurchase,
  mailer: { send: (msg: { to: string; subject: string; text: string }) => Promise<unknown> },
  appUrl: string,
): Promise<{ code: string; created: boolean }> {
  const code = generateCode();
  const { data, error } = await admin
    .from("gift_vouchers")
    .insert({
      code,
      months: gift.months,
      amount_cents: gift.amountCents,
      currency: gift.currency,
      kind: "stripe",
      buyer_email: gift.buyerEmail,
      recipient_name: gift.recipientName,
      message: gift.message,
      stripe_session_id: gift.sessionId,
    })
    .select("code")
    .single();
  if (error) {
    if (error.code !== "23505") throw new Error(`store gift voucher failed: ${error.message}`);
    const { data: existing, error: loadError } = await admin
      .from("gift_vouchers")
      .select("code")
      .eq("stripe_session_id", gift.sessionId)
      .single();
    if (loadError) throw new Error(`load gift voucher failed: ${loadError.message}`);
    return { code: existing.code, created: false };
  }
  if (gift.buyerEmail) {
    await mailer
      .send({
        to: gift.buyerEmail,
        subject: `Твоят подаръчен ваучер · ${giftMonthsLabel(gift.months)} I AM STRONG`,
        text:
          `Благодарим ти!\n\n` +
          `Кодът на ваучера е: ${formatCode(data.code)}\n` +
          `Картичка за печат или изпращане: ${cardUrl(appUrl, data.code)}\n\n` +
          `Как се активира: тя влиза в iamstrong.bg (или си прави профил на iamstrong.bg/start), ` +
          `отива в „Моят план“ и въвежда кода. Членството ѝ започва от този момент.\n` +
          `Кодът важи 12 месеца.\n\n` +
          `Аксения · I AM STRONG`,
      })
      .catch((e: unknown) => console.error("gift e-mail failed:", e));
  }
  return { code: data.code, created: true };
}
