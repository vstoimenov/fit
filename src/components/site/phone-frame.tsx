import Image from "next/image";
import { cn } from "@/lib/cn";

/** A real app screen (390×844 capture) inside a simple ink phone frame. */
export function PhoneFrame({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[390/844] w-full max-w-[300px] overflow-hidden rounded-[40px] border-8 border-ink bg-white",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        // Never preloaded: the desktop call site is hidden on phones, where the preload would only cost data.
        sizes="300px"
        className="object-cover object-top"
      />
    </div>
  );
}
