"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/** Sends one first-party page view per client-side navigation. */
export function VisitBeacon() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    const utm = Object.fromEntries(
      UTM.filter((k) => params.get(k)).map((k) => [k, params.get(k)!.slice(0, 200)]),
    );
    const body = JSON.stringify({
      path: pathname.slice(0, 300),
      referrer: document.referrer.slice(0, 500),
      utm,
    });
    if (!navigator.sendBeacon?.("/api/visit", new Blob([body], { type: "application/json" }))) {
      fetch("/api/visit", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname, params]);

  return null;
}
