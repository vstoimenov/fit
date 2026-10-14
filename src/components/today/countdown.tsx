"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  if (ms <= 0) return "сега";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} д. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes % 60} мин.`;
  return `${minutes % 60} мин.`;
}

export function Countdown({ to }: { to: string }) {
  const [left, setLeft] = useState(() => Date.parse(to) - Date.now());
  useEffect(() => {
    const timer = setInterval(() => setLeft(Date.parse(to) - Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [to]);
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {format(left)}
    </span>
  );
}
