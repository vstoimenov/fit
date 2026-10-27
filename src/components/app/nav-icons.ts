import { BookOpen, Dumbbell, House, User, Users, type LucideIcon } from "lucide-react";
import type { AppNavHref } from "@/lib/app-nav";

export const NAV_ICON: Record<AppNavHref, LucideIcon> = {
  "/app": House,
  "/app/library": Dumbbell,
  "/app/community": Users,
  "/app/learn": BookOpen,
  "/app/profile": User,
};
