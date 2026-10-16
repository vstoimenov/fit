import type { Transition } from "motion/react";

/** Short, soft transitions; instant when the member prefers reduced motion. */
export function transitionFor(reduced: boolean, kind: "page" | "pop"): Transition {
  if (reduced) return { duration: 0 };
  if (kind === "pop") return { type: "spring", stiffness: 420, damping: 28, mass: 0.8 };
  return { duration: 0.25, ease: "easeOut" };
}
