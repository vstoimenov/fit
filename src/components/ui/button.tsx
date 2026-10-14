import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const VARIANT = {
  primary:
    "bg-ember text-white shadow-[0_6px_0_0_var(--color-ember-deep)] active:translate-y-[3px] active:shadow-[0_3px_0_0_var(--color-ember-deep)]",
  ghost: "bg-transparent text-ink ring-2 ring-ink active:translate-y-[2px]",
  quiet: "bg-ink/5 text-ink active:bg-ink/10",
} as const;

const SIZE = { lg: "h-14 px-7 text-base", md: "h-11 px-5 text-sm" } as const;

export function buttonClass(
  variant: keyof typeof VARIANT = "primary",
  size: keyof typeof SIZE = "lg",
) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[transform,box-shadow,background-color] duration-100 disabled:pointer-events-none disabled:opacity-40",
    VARIANT[variant],
    SIZE[size],
  );
}

export function Button({
  variant = "primary",
  size = "lg",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
}) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...props} />;
}
