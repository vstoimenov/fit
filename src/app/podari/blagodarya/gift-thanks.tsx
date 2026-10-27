"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CTA, CTA_SECONDARY } from "@/components/site/styles";
import { formatCode } from "@/lib/gift/code";
import { giftMonthsLabel } from "@/lib/site/gift";

type Found = { code: string; months: number };

const POLL_MS = 2000;
const GIVE_UP_AFTER = 30; // × POLL_MS = 60 s

/** Polls for the voucher of this Checkout session; the webhook usually lands within seconds. */
export function GiftThanks() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const [found, setFound] = useState<Found | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let tries = 0;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/gift/status?session_id=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = (await res.json()) as Found;
          if (!cancelled) setFound(data);
          return;
        }
        if (res.status === 400) {
          if (!cancelled) setBad(true);
          return;
        }
      } catch {
        // Network blip: try again on the next tick.
      }
      if (cancelled) return;
      if (++tries >= GIVE_UP_AFTER) setGaveUp(true);
      else timer = setTimeout(tick, POLL_MS);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  if (!sessionId || bad) {
    return <p className="mt-5 text-lg text-ink-soft">Няма такава поръчка.</p>;
  }
  if (found) {
    return (
      <div className="mt-8 max-w-2xl space-y-6">
        <p className="text-xl leading-relaxed">
          Плащането мина. Ваучерът за {giftMonthsLabel(found.months)} е готов — същият код е и в
          имейла ти.
        </p>
        <p
          className="rounded-3xl bg-sand px-6 py-5 text-center text-3xl font-extrabold tracking-[0.08em] sm:text-4xl"
          aria-label="Код на ваучера"
        >
          {formatCode(found.code)}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/podari/karta/${found.code}`} className={`${CTA} ${CTA_SECONDARY}`}>
            Отвори картичката
          </Link>
        </div>
        <p className="text-ink-soft">
          Как се активира: тя влиза в iamstrong.bg (или си прави профил), отива в „Моят план“ и
          въвежда кода. Кодът важи 12 месеца.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-8 max-w-2xl space-y-4" aria-live="polite">
      <p className="text-xl leading-relaxed">
        {gaveUp
          ? "Поръчката е приета, но кодът се бави. Щом плащането бъде потвърдено, ще го получиш на имейла си; ако до час няма нищо — пиши ни на info@iamstrong.bg."
          : "Поръчката е приета. Чакаме потвърждение от банката и подготвяме кода…"}
      </p>
      {!gaveUp && (
        <span
          className="inline-block size-6 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
