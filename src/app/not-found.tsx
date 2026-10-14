import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <p className="font-display text-7xl font-black text-ember">404</p>
      <h1 className="font-display text-2xl font-bold">Тази страница я няма</h1>
      <Link href="/app" className={buttonClass("primary", "md")}>
        Към тренировките
      </Link>
    </main>
  );
}
