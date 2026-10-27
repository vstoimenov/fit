"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-2xl font-extrabold">Нещо се обърка</h1>
      <p className="text-ink-soft">Не е от теб. Опитай отново след секунда.</p>
      <Button onClick={reset} size="md">
        Опитай пак
      </Button>
      {/* In the home-screen app there is no browser bar: always offer a way out. */}
      <Link href="/app" className={buttonClass("secondary", "md")}>
        Към началото
      </Link>
    </main>
  );
}
