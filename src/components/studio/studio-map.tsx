"use client";

import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { mapLinks } from "@/lib/studio/map";

/**
 * Where the gym is. The Google map loads only when she asks for it, so the page sets no Google
 * cookies by itself (the privacy policy promises no tracking cookies).
 */
export function StudioMap({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const links = mapLinks(address);
  return (
    <section aria-labelledby="zala-map" className="space-y-4">
      <h2 id="zala-map" className="text-xl font-bold">
        Къде е залата
      </h2>
      <p className="flex items-start gap-2 text-lg">
        <MapPin className="mt-1 h-5 w-5 shrink-0 text-rose-deep" aria-hidden />
        {address}
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={links.directions}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("primary", "md")}
        >
          <Navigation className="h-4 w-4" aria-hidden />
          Упътване
        </a>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={buttonClass("secondary", "md")}
          >
            Покажи картата
          </button>
        )}
      </div>
      {open && (
        <iframe
          title={`Карта: ${address}`}
          src={links.embed}
          referrerPolicy="no-referrer-when-downgrade"
          className="aspect-[4/3] w-full rounded-3xl border-0 ring-1 ring-line sm:aspect-[16/9]"
        />
      )}
    </section>
  );
}
