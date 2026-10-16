import { twMerge } from "tailwind-merge";

/** Joins truthy class names; when Tailwind classes conflict, the later one wins. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
