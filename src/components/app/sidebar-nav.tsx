"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV, activeNavHref, navHidden } from "@/lib/app-nav";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { NAV_ICON } from "./nav-icons";

/** Desktop (lg+) left sidebar. Below lg the bottom tab bar is used instead. */
export function SidebarNav() {
  const pathname = usePathname();
  if (navHidden(pathname)) return null;
  const active = activeNavHref(pathname);
  return (
    <nav
      aria-label="Основна навигация"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r border-line bg-white px-4 py-8 lg:flex"
    >
      <Link href="/app" className="px-3">
        <Logo size="md" />
      </Link>
      <ul className="space-y-1">
        {APP_NAV.map((item) => {
          const Icon = NAV_ICON[item.href];
          const isActive = active === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                  isActive ? "bg-powder-chip text-rose-deep" : "text-ink-soft hover:bg-sand",
                )}
              >
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
