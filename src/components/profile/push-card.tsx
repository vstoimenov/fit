"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  claimPushAction,
  setPushHourAction,
  subscribePushAction,
  unsubscribePushAction,
} from "@/app/app/profile/push-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { inputOnCardClass } from "@/components/ui/field";
import { enablePush } from "@/lib/push/enable";
import { pushSupport, type PushSupport } from "@/lib/push/support";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 … 22:00
const DEFAULT_HOUR = 18;

type Status =
  | { kind: "checking" }
  | { kind: "unavailable"; support: Exclude<PushSupport, "ready"> }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

/**
 * „Известия": one tap subscribes this device (permission asked only then) and turns the daily
 * reminder on at the chosen hour; off forgets this device. Without a VAPID key the card says „скоро".
 */
export function PushCard({
  pushHour,
  publicKey,
}: {
  pushHour: number | null;
  publicKey: string | null;
}) {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [hour, setHour] = useState(pushHour ?? DEFAULT_HOUR);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasPush = "PushManager" in window && "serviceWorker" in navigator;
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const permission = "Notification" in window ? Notification.permission : "default";
      const support = pushSupport({ hasPush, isIos, standalone, permission });
      if (support !== "ready") {
        if (!cancelled) setStatus({ kind: "unavailable", support });
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const current = await registration?.pushManager.getSubscription();
      if (cancelled) return;
      if (current) {
        // The device may still be registered to whoever signed in here before, or the server may
        // have forgotten it: re-attach it to her, or save it again, so „Включени“ is true.
        const claim = await claimPushAction(current.toJSON());
        if (claim.ok && !claim.data.claimed) {
          await subscribePushAction(current.toJSON(), pushHour ?? DEFAULT_HOUR);
        }
      }
      if (cancelled) return;
      setStatus(current ? { kind: "on", endpoint: current.endpoint } : { kind: "off" });
    })().catch(() => {
      if (!cancelled) setStatus({ kind: "unavailable", support: "unsupported" });
    });
    return () => {
      cancelled = true;
    };
  }, [pushHour]);

  async function turnOn() {
    if (busy.current || !publicKey) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await enablePush(publicKey, hour);
      if (!result.ok) {
        setError(result.message);
        if (result.denied) setStatus({ kind: "unavailable", support: "denied" });
        return;
      }
      setStatus({ kind: "on", endpoint: result.endpoint });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function turnOff(endpoint: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      const result = await unsubscribePushAction(endpoint);
      if (!result.ok) setError(result.message);
      setStatus({ kind: "off" });
    } catch {
      setError("Не успяхме да изключим известията. Опитай отново.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function changeHour(next: number) {
    setHour(next);
    if (status.kind !== "on") return;
    const result = await setPushHourAction(next);
    if (!result.ok) setError(result.message);
  }

  const on = status.kind === "on";

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          {on ? <Bell size={20} aria-hidden="true" /> : <BellOff size={20} aria-hidden="true" />}
          Известия
        </h2>
        {!publicKey ? (
          <Chip tone="powder">Скоро</Chip>
        ) : (
          <Chip tone={on ? "ink" : "neutral"}>{on ? "Включени" : "Изключени"}</Chip>
        )}
      </div>
      <p className="text-ink-soft">
        Напомняне в избран час, ако още не си тренирала, и известие при нова тренировка.
      </p>

      {!publicKey ? (
        <p className="text-sm text-ink-soft">Известията се подготвят.</p>
      ) : status.kind === "checking" ? (
        <p className="text-sm text-ink-soft" aria-busy="true">
          Проверяваме устройството…
        </p>
      ) : status.kind === "unavailable" ? (
        <p className="text-sm text-ink-soft">
          {status.support === "ios_install"
            ? "На iPhone известията работят, когато клубът е добавен на началния екран: Сподели → „Добави към началния екран“, после влез оттам."
            : status.support === "denied"
              ? "Известията са забранени за сайта. Разреши ги от настройките на браузъра и опитай пак."
              : "Този браузър не поддържа известия. Опитай в Chrome или Safari на телефона."}
        </p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">Напомняне в</span>
            <select
              value={hour}
              onChange={(event) => void changeHour(Number(event.target.value))}
              className={`${inputOnCardClass} max-w-32`}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          {on ? (
            <Button
              variant="secondary"
              size="md"
              onClick={() => void turnOff(status.endpoint)}
              disabled={pending}
              className="w-full"
            >
              Изключи на това устройство
            </Button>
          ) : (
            <Button size="md" onClick={() => void turnOn()} disabled={pending} className="w-full">
              {pending ? "Момент…" : "Включи известията"}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </Card>
  );
}
