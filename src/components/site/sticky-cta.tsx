"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Phone-only bottom bar with the main call to action. Appears once the hero has scrolled away
 * and hides again while the footer is on screen.
 */
export function StickyCta() {
  const [heroGone, setHeroGone] = useState(false);
  const [footerSeen, setFooterSeen] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const footer = document.getElementById("site-footer");
    if (!hero || !footer) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroGone(!e.isIntersecting);
        if (e.target === footer) setFooterSeen(e.isIntersecting);
      }
    });
    io.observe(hero);
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  const visible = heroGone && !footerSeen;
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 md:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex gap-2">
        <Link
          href="/start"
          tabIndex={visible ? 0 : -1}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-base font-bold text-white"
        >
          Започни безплатно <span aria-hidden>→</span>
        </Link>
        <Link
          href="/login"
          tabIndex={visible ? 0 : -1}
          className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-ink px-5 text-base font-bold text-ink"
        >
          Вход
        </Link>
      </div>
    </div>
  );
}
