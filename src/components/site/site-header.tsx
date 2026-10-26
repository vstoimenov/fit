"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "#kak-raboti", label: "Как работи" },
  { href: "#vatre", label: "Какво има вътре" },
  { href: "#aksenia", label: "Аксения" },
  { href: "#ceni", label: "Цени" },
  { href: "#vaprosi", label: "Въпроси" },
] as const;

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[15px] font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * Public-site header: transparent on top, white with a hairline after 24 px of scroll.
 * On phones the section links live in a full-screen menu (a native <dialog>, so Escape and focus
 * trapping come for free).
 */
export function SiteHeader({ showFounders }: { showFounders: boolean }) {
  const [solid, setSolid] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => menu.current?.close();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors",
        solid ? "border-b border-line bg-white" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-4 lg:px-10">
        <Link href="/" className="shrink-0">
          <Logo size="md" />
        </Link>

        <nav aria-label="Секции" className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[15px] font-semibold text-ink underline-offset-4 hover:underline"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {showFounders && (
            <Link
              href="/osnovatelki"
              className="hidden min-h-11 items-center px-2 text-[15px] font-semibold text-rose-deep underline-offset-4 hover:underline sm:inline-flex"
            >
              Основателки
            </Link>
          )}
          <Link
            href="/login"
            className={cn(BTN, "border-[1.5px] border-ink text-ink hover:bg-sand")}
          >
            Вход
          </Link>
          <Link
            href="/start"
            className={cn(BTN, "hidden bg-ink text-white hover:bg-[#2A2A2A] sm:inline-flex")}
          >
            Започни
          </Link>
          <button
            type="button"
            onClick={() => menu.current?.showModal()}
            className={cn(BTN, "bg-ink text-white lg:hidden")}
            aria-haspopup="dialog"
          >
            Меню
          </button>
        </div>
      </div>

      <dialog
        ref={menu}
        aria-label="Меню"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-white p-0 text-ink backdrop:bg-ink/40 open:flex open:flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <Logo size="md" />
          <button
            type="button"
            onClick={closeMenu}
            className={cn(BTN, "border-[1.5px] border-ink text-ink")}
          >
            Затвори
          </button>
        </div>
        <nav aria-label="Секции" className="flex flex-col gap-1 px-6 pt-6">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={closeMenu}
              className="rounded-xl px-3 py-4 text-2xl font-extrabold tracking-[-0.02em] hover:bg-sand"
            >
              {l.label}
            </a>
          ))}
          {showFounders && (
            <Link
              href="/osnovatelki"
              onClick={closeMenu}
              className="rounded-xl px-3 py-4 text-2xl font-extrabold tracking-[-0.02em] text-rose-deep hover:bg-sand"
            >
              Основателки
            </Link>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-6 pb-8">
          <Link
            href="/start"
            onClick={closeMenu}
            className={cn(BTN, "min-h-14 bg-ink text-lg text-white")}
          >
            Започни безплатно →
          </Link>
          <Link
            href="/login"
            onClick={closeMenu}
            className={cn(BTN, "min-h-14 border-[1.5px] border-ink text-lg text-ink")}
          >
            Вход
          </Link>
        </div>
      </dialog>
    </header>
  );
}
