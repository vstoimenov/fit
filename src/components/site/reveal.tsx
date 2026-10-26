import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fades a block in (and lifts it 12 px) as it appears. Pure CSS: the server and the client render
 * identical markup, visitors with reduced motion get the final state at once, and the text is
 * visible even before JavaScript runs.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children?: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "span";
}) {
  return (
    <Tag
      className={cn("animate-site-reveal motion-reduce:animate-none", className)}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </Tag>
  );
}
