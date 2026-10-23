import { Apple, BookOpen, Dumbbell, House, User, type LucideIcon } from "lucide-react";
import type { AppNavHref } from "@/lib/app-nav";

export const NAV_ICON: Record<AppNavHref, LucideIcon> = {
  "/app": House,
  "/app/library": Dumbbell,
  "/app/nutrition": Apple,
  "/app/learn": BookOpen,
  "/app/profile": User,
};
