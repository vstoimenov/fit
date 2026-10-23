"use client";

import { Check, LoaderCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { copyText, downloadFile, isAbort } from "@/lib/share/browser";
import { pickShareMode } from "@/lib/share/share-mode";

const FILE_NAME = "trenirovka.png";
const FAILED = "Не успяхме да споделим. Опитай пак.";

async function loadImage(completionId: string): Promise<File> {
  const res = await fetch(`/api/share/${encodeURIComponent(completionId)}?format=story`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`share image ${res.status}`);
  return new File([await res.blob()], FILE_NAME, { type: "image/png" });
}

/**
 * „Сподели" after a workout: her story image (rendered server-side from title, streak and
 * week only) via the Web Share sheet; without Web Share the image is downloaded and the text
 * copied. `text` must come from `shareText`, so it carries nothing beyond those numbers.
 *
 * The image is fetched as soon as the screen opens: share sheets and the clipboard need the
 * tap's user activation, which a network round trip inside the click handler can outlast.
 */
export function ShareButton({ completionId, text }: { completionId: string; text: string }) {
  const [state, setState] = useState<"idle" | "busy" | "copied">("idle");
  const [error, setError] = useState("");
  const image = useRef<Promise<File> | null>(null);
  const ready = useRef<File | null>(null);
  const busy = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const p = loadImage(completionId);
    image.current = p;
    p.then(
      (file) => {
        if (image.current === p) ready.current = file;
      },
      () => {
        // Retried on tap.
        if (image.current === p) image.current = null;
      },
    );
    return () => {
      image.current = null;
      ready.current = null;
      clearTimeout(copiedTimer.current);
    };
  }, [completionId]);

  async function share() {
    if (busy.current) return;
    busy.current = true;
    setState("busy");
    setError("");
    let next: "idle" | "copied" = "idle";
    try {
      let file = ready.current;
      if (!file) {
        image.current ??= loadImage(completionId);
        file = await image.current;
        ready.current = file;
      }
      const url = window.location.origin;
      const mode = pickShareMode(navigator, file);

      if (mode === "files") {
        await navigator.share({ files: [file], text, url });
      } else if (mode === "text") {
        await navigator.share({ text, url });
      } else {
        // Started before the download so it still runs inside the tap's activation.
        const copied = copyText(`${text} ${url}`);
        downloadFile(file);
        // The image is saved either way; a blocked clipboard is not worth an error.
        if (await copied) next = "copied";
      }
    } catch (e) {
      // She closed the share sheet: not an error.
      if (!isAbort(e)) setError(FAILED);
      if (!ready.current) image.current = null;
    } finally {
      busy.current = false;
      setState(next);
      if (next === "copied") {
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setState("idle"), 2000);
      }
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={share}
        disabled={state === "busy"}
        aria-busy={state === "busy"}
        className={cn(buttonClass("secondary", "lg"), "w-full")}
      >
        {state === "busy" ? (
          <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
        ) : state === "copied" ? (
          <Check size={20} aria-hidden="true" />
        ) : (
          <Share2 size={20} aria-hidden="true" />
        )}
        {state === "copied" ? "Копирано" : "Сподели"}
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Картинката е изтеглена, текстът е копиран." : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </div>
  );
}
