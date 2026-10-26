"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Lifts a block in the first time it scrolls into view. The server renders it fully visible;
 * only after hydration are the blocks still below the fold hidden and then revealed on entry,
 * so nothing is missing without JavaScript and nothing flashes. Reduced motion: no transition.
 */
export function ScrollReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    // Already on screen: leave it as it is.
    if (rect.top < window.innerHeight * 0.9) return;
    el.classList.add("site-pre-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("site-revealed");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
