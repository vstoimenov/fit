import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { formatCode } from "@/lib/gift/code";
import { giftMonthsLabel } from "@/lib/site/gift";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { getVoucherCard } from "@/server/gift/card";
import { PrintButton } from "./print-button";

export const metadata = { title: "Подаръчна картичка", robots: { index: false, follow: false } };

/** Printable gift card. Reachable only with the code, which is the buyer's secret. */
export default function GiftCardPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-sand" aria-busy="true" />}>
      <GiftCard params={params} />
    </Suspense>
  );
}

async function GiftCard({ params }: { params: Promise<{ code: string }> }) {
  // The code is request data: opt out of prerendering before reading it.
  await connection();
  const { code } = await params;
  const card = await getVoucherCard(createAdminSupabaseClient(), code);
  if (!card) notFound();
  const expires = new Date(card.expiresAt).toLocaleDateString("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <main className="min-h-dvh bg-sand px-4 py-10 print:bg-white print:p-0">
      <article className="mx-auto max-w-[560px] overflow-hidden rounded-[28px] bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="bg-ink px-8 py-10 text-white">
          <Logo tone="white" />
          <p className="mt-8 text-[13px] font-semibold tracking-[0.14em] text-white/70 uppercase">
            Подаръчен ваучер
          </p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-[-0.03em]">Подари сила.</h1>
          <p className="mt-3 text-xl">{giftMonthsLabel(card.months)} членство в клуба</p>
        </div>
        <div className="space-y-6 px-8 py-8">
          {card.recipientName && <p className="text-2xl font-extrabold">За {card.recipientName}</p>}
          {card.message && (
            <p className="text-lg leading-relaxed text-ink-soft">„{card.message}“</p>
          )}
          <div className="rounded-2xl bg-powder-light px-6 py-5 text-center">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep uppercase">
              Твоят код
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-[0.08em]">
              {formatCode(card.code)}
            </p>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
            <li>Влез в iamstrong.bg или си направи профил на iamstrong.bg/start.</li>
            <li>Отвори „Моят план“ и въведи кода.</li>
            <li>Членството започва веднага — за {giftMonthsLabel(card.months)}.</li>
          </ol>
          <p className="text-sm text-ink-soft">
            Кодът важи до {expires}
            {card.redeemed ? " Вече е активиран." : ""}
          </p>
        </div>
      </article>
      <div className="mx-auto mt-6 flex max-w-[560px] flex-wrap gap-3 print:hidden">
        <PrintButton />
        <a
          href={`/api/gift/${card.code}/card`}
          download={`iamstrong-vaucher-${card.code}.png`}
          className="inline-flex h-12 items-center rounded-full bg-transparent px-6 font-semibold text-ink ring-[1.5px] ring-ink ring-inset"
        >
          Свали като картинка
        </a>
      </div>
    </main>
  );
}
