/** The four tabs of the member app (bottom bar on mobile, sidebar on desktop). */
export const APP_NAV = [
  { href: "/app", label: "Днес" },
  { href: "/app/library", label: "Тренировки" },
  { href: "/app/progress", label: "Прогрес" },
  { href: "/app/profile", label: "Профил" },
] as const;

export type AppNavHref = (typeof APP_NAV)[number]["href"];

function under(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Which tab a pathname belongs to; null when none is active (e.g. the welcome screen). */
export function activeNavHref(pathname: string): AppNavHref | null {
  if (pathname === "/app") return "/app";
  if (under(pathname, "/app/library")) return "/app/library";
  if (under(pathname, "/app/progress") || under(pathname, "/app/check-in")) return "/app/progress";
  if (under(pathname, "/app/profile") || under(pathname, "/app/plan")) return "/app/profile";
  return null;
}

/** The workout player is full screen: neither the tab bar nor the sidebar shows. */
export function navHidden(pathname: string): boolean {
  return pathname.startsWith("/app/workout/");
}
