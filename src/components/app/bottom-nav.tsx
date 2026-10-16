"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV, activeNavHref, navHidden } from "@/lib/app-nav";
import { cn } from "@/lib/cn";
import { NAV_ICON } from "./nav-icons";

/** Mobile tab bar. Desktop gets the sidebar instead. */
export function BottomNav() {
  const pathname = usePathname();
  if (navHidden(pathname)) return null;
  const active = activeNavHref(pathname);
  return (
    <nav
      aria-label="Основна навигация"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white lg:hidden"
    >
      <ul className="mx-auto flex max-w-md justify-around px-2 pt-1">
        {APP_NAV.map((item) => {
          const Icon = NAV_ICON[item.href];
          const isActive = active === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-semibold",
                  isActive ? "text-rose-deep" : "text-ink-soft",
                )}
              >
                <Icon
                  size={24}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={isActive ? "text-powder" : "text-ink-soft"}
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
