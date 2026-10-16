import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6 text-ink">
      <p className="text-7xl font-extrabold tracking-tight">404</p>
      <h1 className="text-2xl font-extrabold tracking-tight">Тази страница я няма</h1>
      <Link href="/" className={buttonClass("primary", "lg")}>
        Към началото
      </Link>
    </main>
  );
}
