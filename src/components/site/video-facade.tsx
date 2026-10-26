"use client";

import { Lock, Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { VideoRef } from "@/lib/video/parse-video-url";

/**
 * A poster with a play button. The provider's iframe is created only when the visitor clicks, so
 * nothing third-party loads with the page. `locked` shows a lock and hands the click to the caller
 * (the lead form) instead of playing.
 */
export function VideoFacade({
  video,
  posterSrc,
  title,
  durationMin,
  locked = false,
  onLockedClick,
  className,
}: {
  video: VideoRef;
  posterSrc: string;
  title: string;
  durationMin?: number;
  locked?: boolean;
  onLockedClick?: () => void;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const label = durationMin ? `Пусни · ${durationMin} мин` : "Пусни";

  if (playing) {
    const src = `${video.embedUrl}${video.embedUrl.includes("?") ? "&" : "?"}autoplay=1`;
    return (
      <div className={cn("relative aspect-video overflow-hidden rounded-3xl bg-ink", className)}>
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-3xl bg-sand", className)}>
      <Image
        src={posterSrc}
        alt=""
        fill
        sizes="(min-width:1024px) 640px, 100vw"
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-ink/20" />
      <button
        type="button"
        onClick={() => (locked ? onLockedClick?.() : setPlaying(true))}
        aria-label={locked ? `${title}: отключи с име и имейл` : `${title}: ${label}`}
        className="absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
      >
        <span className="inline-flex min-h-14 items-center gap-3 rounded-full bg-white px-6 text-lg font-bold text-ink">
          {locked ? (
            <Lock size={20} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Play size={20} strokeWidth={2.2} aria-hidden="true" className="fill-ink" />
          )}
          {label}
        </span>
      </button>
    </div>
  );
}
