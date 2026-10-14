"use client";

import { useSearchParams } from "next/navigation";

/** Shown after the account deletion redirect (`/?deleted=1`). Render inside <Suspense>. */
export function DeletedNotice() {
  const deleted = useSearchParams().get("deleted") === "1";
  if (!deleted) return null;
  return (
    <p role="status" className="rounded-2xl bg-moss/15 px-4 py-3 font-semibold text-moss">
      Профилът ти е изтрит.
    </p>
  );
}
