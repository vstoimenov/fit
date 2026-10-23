"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { removeProgressPhoto } from "@/app/app/progress/photos/actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const FAILED = "Не успяхме да изтрием снимката. Опитай пак.";

/** „Изтрий снимката" with a confirm step; on success the action redirects back to the grid. */
export function DeletePhoto({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function remove() {
    setError("");
    startTransition(async () => {
      try {
        const result = await removeProgressPhoto(id);
        // Only a failure returns; success redirects.
        if (!result.ok) setError(result.message);
      } catch {
        setError(FAILED);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={cn(buttonClass("link"), "gap-1.5 text-ink-soft")}
      >
        <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
        Изтрий снимката
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-sand p-4">
      <p className="font-semibold">Сигурна ли си? Снимката изчезва завинаги.</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-busy={pending}
          className={cn(buttonClass("secondary", "md"), "text-brick")}
        >
          {pending && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
          Изтрий
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError("");
          }}
          disabled={pending}
          className={buttonClass("link")}
        >
          Отказ
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </div>
  );
}
