import Image from "next/image";
import { cn } from "@/lib/cn";
import { coverPhoto } from "@/lib/photos";

/**
 * Photo cover for a workout, picked by its (first) focus. The title sits on a solid
 * dark band at the bottom so it stays readable on any photo (no gradient).
 */
export function WorkoutCover({
  focus,
  title,
  className,
  preload = false,
  showTitle = true,
  sizes = "(min-width: 1024px) 640px, 100vw",
  decorative = false,
}: {
  focus: string | null;
  title: string;
  className?: string;
  /** Eager-load the photo when the cover is the first thing on screen. */
  preload?: boolean;
  /** Show the title band. Off where the title is rendered elsewhere (library cards). */
  showTitle?: boolean;
  /** `sizes` hint for the responsive image. */
  sizes?: string;
  /** Empty alt: the cover sits inside a link that already names the workout. */
  decorative?: boolean;
}) {
  const photo = coverPhoto(focus);
  return (
    <div className={cn("relative overflow-hidden bg-sand", className)}>
      <Image
        src={photo.src}
        alt={decorative ? "" : photo.alt}
        fill
        preload={preload}
        sizes={sizes}
        className="object-cover"
      />
      {showTitle && (
        <p className="absolute inset-x-0 bottom-0 line-clamp-2 bg-ink/70 px-4 py-3 text-sm font-extrabold leading-snug text-white">
          {title}
        </p>
      )}
    </div>
  );
}
