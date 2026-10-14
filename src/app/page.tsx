import Link from "next/link";
import { Suspense } from "react";
import { DeletedNotice } from "@/components/landing/deleted-notice";
import { buttonClass } from "@/components/ui/button";
import { brand } from "@/lib/brand";

// Placeholder until the marketing pass designs the real landing page.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-10">
      <p className="font-display text-lg font-bold">{brand.name}</p>
      <div className="space-y-6">
        <Suspense>
          <DeletedNotice />
        </Suspense>
        <h1 className="font-display text-4xl font-black leading-[1]">{brand.tagline}</h1>
        <p className="text-lg text-ink-soft">
          Отговори на 6 въпроса и направи първата си тренировка безплатно.
        </p>
      </div>
      <div className="space-y-3">
        <Link href="/start" className={buttonClass("primary", "lg") + " w-full"}>
          Започни безплатно
        </Link>
        <Link href="/login" className={buttonClass("quiet", "lg") + " w-full"}>
          Имам профил
        </Link>
      </div>
    </main>
  );
}
