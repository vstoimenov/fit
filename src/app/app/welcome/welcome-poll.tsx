"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { PHOTOS } from "@/lib/photos";
import { checkAccessAction } from "./actions";

const POLL_MS = 1500;
const GIVE_UP_MS = 15_000;

/** The webhook may land a moment after the redirect from Checkout: poll until access opens. */
export function WelcomePoll() {
  const router = useRouter();
  const [state, setState] = useState<"waiting" | "active" | "slow">("waiting");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    async function tick() {
      if (cancelled) return;
      // A rejected call (network blip, redeploy) counts as "not yet": keep polling until the deadline.
      const result = await checkAccessAction().catch(() => null);
      if (cancelled) return;
      if (result?.ok && result.data) {
        setState("active");
        timer = setTimeout(() => router.replace("/app"), 1200);
        return;
      }
      if (Date.now() - started > GIVE_UP_MS) return setState("slow");
      timer = setTimeout(tick, POLL_MS);
    }
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-8">
      <div className="relative h-56 overflow-hidden rounded-2xl bg-sand">
        <Image
          src={PHOTOS.welcome.src}
          alt={PHOTOS.welcome.alt}
          fill
          preload
          sizes="(min-width: 448px) 448px, 100vw"
          className="object-cover"
        />
      </div>
      <h1 className="font-display text-[34px] leading-[1.05] tracking-[-0.02em]">Добре дошла</h1>
      {state === "waiting" && (
        <p role="status" className="text-lg font-semibold">
          Потвърждаваме плащането…
        </p>
      )}
      {state === "active" && (
        <p role="status" className="text-lg font-semibold">
          Добре дошла! Абонаментът е активен.
        </p>
      )}
      {state === "slow" && (
        <>
          <p className="text-lg font-semibold">Плащането се обработва</p>
          <p className="text-ink-soft">
            Ще получиш имейл, а достъпът ще се отвори автоматично до минута.
          </p>
          <Link href="/app" className={buttonClass("secondary") + " w-full"}>
            Към „Днес“
          </Link>
        </>
      )}
    </main>
  );
}
