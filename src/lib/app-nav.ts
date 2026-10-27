/**
 * The five tabs of the member app (bottom bar on mobile, sidebar on desktop). „Хранене“ is reached
 * from its card on Начало and from Профил (the engagement spec's final navigation).
 */
export const APP_NAV = [
  { href: "/app", label: "Начало" },
  { href: "/app/library", label: "Тренировки" },
  { href: "/app/community", label: "Общност" },
  { href: "/app/learn", label: "Полезно" },
  { href: "/app/profile", label: "Профил" },
] as const;

export type AppNavHref = (typeof APP_NAV)[number]["href"];

function under(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Which tab a pathname belongs to; null when none is active (e.g. the welcome screen). */
export function activeNavHref(pathname: string): AppNavHref | null {
  // Предизвикателствата са част от Начало: картата там води към тях.
  if (pathname === "/app" || under(pathname, "/app/challenges")) return "/app";
  if (under(pathname, "/app/library")) return "/app/library";
  if (under(pathname, "/app/community")) return "/app/community";
  // Хранене opens from its card on Начало.
  if (under(pathname, "/app/nutrition")) return "/app";
  if (under(pathname, "/app/learn")) return "/app/learn";
  // Прогрес is reached from Начало and Профил, so it (and the check-in) belong to Профил.
  if (
    under(pathname, "/app/profile") ||
    under(pathname, "/app/plan") ||
    under(pathname, "/app/progress") ||
    under(pathname, "/app/check-in")
  ) {
    return "/app/profile";
  }
  return null;
}

/** The workout player is full screen: neither the tab bar nor the sidebar shows. */
export function navHidden(pathname: string): boolean {
  return pathname.startsWith("/app/workout/");
}
