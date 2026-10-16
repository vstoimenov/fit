"use client";

import { usePathname } from "next/navigation";
import { navHidden } from "@/lib/app-nav";

/** Renders its children everywhere except the full-screen workout player. */
export function HideOnPlayer({ children }: { children: React.ReactNode }) {
  if (navHidden(usePathname())) return null;
  return <>{children}</>;
}
