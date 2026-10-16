import Image from "next/image";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { PHOTOS } from "@/lib/photos";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-12 pt-4 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8 lg:pb-20 lg:pt-10">
      <div className="space-y-6">
        <h1 className="font-display text-[2.5rem] leading-[1.05] font-extrabold text-balance sm:text-5xl lg:text-6xl">
          {brand.tagline}
        </h1>
        <p className="max-w-prose text-lg text-ink-soft">{brand.description}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/start" className={buttonClass("primary", "lg")}>
            Започни безплатно
          </Link>
          <Link href="/login" className={buttonClass("secondary", "lg")}>
            Имам профил
          </Link>
        </div>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand">
        <Image
          src={PHOTOS.hero.src}
          alt={PHOTOS.hero.alt}
          fill
          priority
          sizes="(min-width: 1024px) 560px, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}
