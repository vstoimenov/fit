import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// `quiet` and `ghost` are legacy names kept so untouched callers compile.
const VARIANT = {
  primary: "bg-ink text-white active:opacity-85",
  secondary: "bg-transparent text-ink ring-[1.5px] ring-inset ring-ink active:bg-ink/5",
  link: "min-h-11 bg-transparent px-1 text-ink underline underline-offset-4 active:opacity-70",
  quiet: "bg-transparent text-ink ring-[1.5px] ring-inset ring-ink active:bg-ink/5",
  ghost: "bg-transparent text-ink ring-[1.5px] ring-inset ring-ink active:bg-ink/5",
} as const;

const SIZE = { lg: "h-14 px-7 text-base", md: "h-11 px-5 text-sm" } as const;

export function buttonClass(
  variant: keyof typeof VARIANT = "primary",
  size: keyof typeof SIZE = "lg",
) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 font-semibold transition-[opacity,background-color] duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40",
    variant === "link" ? "rounded-md" : "rounded-full",
    VARIANT[variant],
    variant === "link" ? "text-sm" : SIZE[size],
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
