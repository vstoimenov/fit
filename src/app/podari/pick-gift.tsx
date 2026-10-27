"use client";

import { CTA, CTA_PRIMARY } from "@/components/site/styles";
import { cn } from "@/lib/cn";

/** „Купи ваучер" on an option card: selects that period in the order form and scrolls to it. */
export function PickGift({ months, onInk }: { months: number; onInk: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        const radio = document.getElementById(`gift-m-${months}`) as HTMLInputElement | null;
        if (radio) radio.checked = true;
        const form = document.getElementById("porachka");
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        form?.querySelector<HTMLInputElement>("input[name=email]")?.focus({ preventScroll: true });
      }}
      className={cn(CTA, onInk ? "bg-white text-ink" : CTA_PRIMARY)}
    >
      Купи ваучер
    </button>
  );
}
