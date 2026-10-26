"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-white"
    >
      Принтирай
    </button>
  );
}
