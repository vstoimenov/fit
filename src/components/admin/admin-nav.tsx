"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Табло" },
  { href: "/admin/calendar", label: "Календар" },
  { href: "/admin/workouts", label: "Тренировки" },
  { href: "/admin/clients", label: "Клиентки" },
  { href: "/admin/activity", label: "Активност" },
  { href: "/admin/at-risk", label: "Изостават" },
  { href: "/admin/settings", label: "Настройки" },
  { href: "/admin/audit", label: "Одит" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-line bg-white lg:min-h-dvh lg:border-b-0 lg:border-r">
      <p className="px-4 pt-4 font-display text-lg font-bold">Админ</p>
      <ul className="flex gap-1 overflow-x-auto px-2 py-3 lg:flex-col">
        {ITEMS.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold",
                  active ? "bg-ink text-paper" : "text-ink-soft hover:bg-ink/5",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="lg:mt-4">
          <Link
            href="/app"
            className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-ink/5"
          >
            ← Към приложението
          </Link>
        </li>
      </ul>
    </nav>
  );
}
