"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/app", label: "Днес", match: (p: string) => p === "/app" },
  { href: "/app/library", label: "Библиотека", match: (p: string) => p.startsWith("/app/library") },
  {
    href: "/app/profile",
    label: "Профил",
    match: (p: string) => p.startsWith("/app/profile") || p.startsWith("/app/check-in"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/app/workout/")) return null; // the player is full-screen
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-around px-4 pt-2">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-1 text-xs font-semibold transition-colors",
                  active ? "text-ink" : "text-ink-soft",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-all",
                    active ? "bg-ember" : "bg-transparent",
                  )}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
