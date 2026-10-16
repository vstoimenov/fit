import { BookOpen, ChartLine, Dumbbell, House, User, type LucideIcon } from "lucide-react";
import type { AppNavHref } from "@/lib/app-nav";

export const NAV_ICON: Record<AppNavHref, LucideIcon> = {
  "/app": House,
  "/app/library": Dumbbell,
  "/app/progress": ChartLine,
  "/app/learn": BookOpen,
  "/app/profile": User,
};
