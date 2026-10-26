import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg";
type Tone = "ink" | "white" | "on-powder";

const BASE: Record<Size, string> = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[28px]",
};

/**
 * The word mark: „I AM" in Manrope plus a powder marker with a handwritten „Strong".
 * `tone="white"` for ink backgrounds (the marker stays powder with ink text — on pink only
 * black), `tone="on-powder"` for powder backgrounds (the marker flips to ink with white text).
 */
export function Logo({
  size = "md",
  tone = "ink",
  className,
}: {
  size?: Size;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="I AM STRONG"
      className={cn(
        "inline-flex items-center gap-[0.4em] leading-none font-extrabold tracking-[-0.01em] whitespace-nowrap",
        BASE[size],
        tone === "white" ? "text-white" : "text-ink",
        className,
      )}
    >
      <span aria-hidden="true">I AM</span>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center rounded-[0.35em] px-[0.4em] pt-[0.05em] pb-[0.18em] font-script text-[1.35em] leading-none font-normal",
          tone === "on-powder" ? "bg-ink text-white" : "bg-powder text-ink",
        )}
      >
        Strong
      </span>
    </span>
  );
}
