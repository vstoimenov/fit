"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      {state === "waiting" && (
        <p role="status" className="font-display text-2xl font-bold">
          Потвърждаваме плащането…
        </p>
      )}
      {state === "active" && (
        <p role="status" className="font-display text-2xl font-bold">
          Добре дошла! Абонаментът е активен.
        </p>
      )}
      {state === "slow" && (
        <>
          <p className="font-display text-xl font-bold">Плащането се обработва</p>
          <p className="text-ink-soft">
            Ще получиш имейл, а достъпът ще се отвори автоматично до минута.
          </p>
          <Link href="/app" className="underline underline-offset-4">
            Към „Днес“
          </Link>
        </>
      )}
    </main>
  );
}
