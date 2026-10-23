"use client";

import { Check, LoaderCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/progress-photos/format-date";
import { defaultBefore } from "@/lib/progress-photos/pair";
import { drawShareImage } from "@/lib/progress-photos/share-image";
import { progressShareText } from "@/lib/progress-photos/share-text";
import { copyText, downloadFile, isAbort } from "@/lib/share/browser";
import { pickShareMode } from "@/lib/share/share-mode";

type Candidate = { id: string; url: string; takenOn: string };
type Prepared = { key: string; file: File; src: string };

const SHARE_FAILED = "Не успяхме да споделим. Опитай пак.";
const PREPARE_FAILED = "Не успяхме да подготвим картинката.";

const FRAME = "mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl bg-sand";

/**
 * One photo, or a before/after pair, as the branded share picture. The picture is drawn as soon as the
 * choice changes (share sheets and the clipboard need the tap's user activation, which drawing inside
 * the click handler could outlast), shown as a live preview, and shared or downloaded on „Сподели".
 */
export function PhotoShare({
  after,
  candidates,
  host,
  siteUrl,
}: {
  after: { url: string | null; takenOn: string };
  candidates: Candidate[];
  host: string;
  siteUrl: string;
}) {
  const [mode, setMode] = useState<"single" | "pair">("single");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "copied">("idle");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasPair = candidates.length > 0;
  // Oldest first, so the default pick (the earliest) is the first thumbnail.
  const stripOrder = [...candidates].sort((a, b) =>
    a.takenOn < b.takenOn ? -1 : a.takenOn > b.takenOn ? 1 : 0,
  );
  const selectedId =
    pickedId && candidates.some((c) => c.id === pickedId) ? pickedId : defaultBefore(candidates);
  const before =
    mode === "pair" && hasPair ? (candidates.find((c) => c.id === selectedId) ?? null) : null;

  const afterUrl = after.url;
  const afterDay = after.takenOn;
  const beforeUrl = before?.url ?? null;
  const beforeDay = before?.takenOn ?? null;
  const key = `${afterUrl}|${beforeUrl ?? ""}`;

  useEffect(() => {
    if (!afterUrl) return;
    let cancelled = false;
    let src: string | null = null;
    drawShareImage({
      after: { url: afterUrl, takenOn: afterDay },
      before: beforeUrl && beforeDay ? { url: beforeUrl, takenOn: beforeDay } : undefined,
      host,
    }).then(
      (file) => {
        if (cancelled) return;
        src = URL.createObjectURL(file);
        setPrepared({ key, file, src });
      },
      () => {
        if (!cancelled) setFailedKey(key);
      },
    );
    return () => {
      cancelled = true;
      if (src) URL.revokeObjectURL(src);
    };
  }, [afterUrl, afterDay, beforeUrl, beforeDay, host, key, attempt]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (!afterUrl) {
    return (
      <div className={cn(FRAME, "flex items-center justify-center p-6 text-center text-ink-soft")}>
        Снимката не е налична. Обнови страницата.
      </div>
    );
  }

  const ready = prepared?.key === key ? prepared : null;
  const failed = !ready && failedKey === key;

  async function share() {
    if (!ready || busy.current) return;
    const { file } = ready;
    busy.current = true;
    setState("busy");
    setError("");
    const text = progressShareText(siteUrl);
    let next: "idle" | "copied" = "idle";
    try {
      const shareMode = pickShareMode(navigator, file);
      if (shareMode === "files") {
        await navigator.share({ files: [file], text });
      } else {
        // No file sharing here (text-only share sheets would drop the picture): save it and copy the text.
        // Started before the download so it still runs inside the tap's activation.
        const copied = copyText(text);
        downloadFile(file);
        // The image is saved either way; a blocked clipboard is not worth an error.
        if (await copied) next = "copied";
      }
    } catch (e) {
      // She closed the share sheet: not an error.
      if (!isAbort(e)) setError(SHARE_FAILED);
    } finally {
      busy.current = false;
      setState(next);
      if (next === "copied") {
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setState("idle"), 2000);
      }
    }
  }

  function retry() {
    setFailedKey(null);
    setAttempt((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      {hasPair && (
        <div role="group" aria-label="Каква картинка да споделиш" className="flex gap-2">
          {(
            [
              ["single", "Само снимката"],
              ["pair", "Преди / След"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "min-h-11 flex-1 rounded-full px-4 text-sm font-semibold ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                mode === value ? "bg-powder-chip text-ink" : "bg-white text-ink-soft",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={FRAME}>
        {ready ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL of the picture just drawn
          <img
            src={ready.src}
            alt={
              before
                ? "Картинка за споделяне: преди и след"
                : "Картинка за споделяне с твоята снимка"
            }
            className="size-full object-cover"
          />
        ) : failed ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p role="alert" className="font-semibold text-brick">
              {PREPARE_FAILED}
            </p>
            <button type="button" onClick={retry} className={buttonClass("secondary", "md")}>
              Опитай пак
            </button>
          </div>
        ) : (
          <div
            className="flex size-full items-center justify-center text-ink-soft"
            role="status"
            aria-label="Подготвяме картинката"
          >
            <LoaderCircle size={28} className="animate-spin" aria-hidden="true" />
          </div>
        )}
      </div>

      {mode === "pair" && hasPair && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Избери снимка за „ПРЕДИ“</p>
          <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
            {stripOrder.map((candidate) => {
              const day = formatLongDate(candidate.takenOn);
              const selected = candidate.id === selectedId;
              return (
                <li key={candidate.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`ПРЕДИ: ${day}`}
                    onClick={() => setPickedId(candidate.id)}
                    className={cn(
                      "block w-20 rounded-xl p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      selected ? "ring-2 ring-ink" : "ring-1 ring-line",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URLs */}
                    <img
                      src={candidate.url}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <span className="mt-1 block text-[11px] leading-tight text-ink-soft">
                      {day}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={share}
        disabled={!ready || state === "busy"}
        aria-busy={!ready || state === "busy"}
        className={cn(buttonClass("primary", "lg"), "w-full")}
      >
        {state === "busy" || (!ready && !failed) ? (
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
