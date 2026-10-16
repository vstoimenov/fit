import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const TONE = {
  neutral: "bg-sand text-ink",
  powder: "bg-powder-chip text-rose-deep",
  ink: "bg-ink text-white",
} as const;

export function Chip({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONE }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
