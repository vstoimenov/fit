"use client";

import { Bell, Check, Smartphone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { nutritionGate, type NutritionGate } from "@/lib/nutrition/gate";
import { enablePush } from "@/lib/push/enable";
import { pushSupport, type PushSupport } from "@/lib/push/support";

const UNLOCKED_KEY = "iamstrong.nutrition-unlocked";

type Device = {
  mobile: boolean;
  ios: boolean;
  standalone: boolean;
  inApp: boolean;
  support: PushSupport;
  pushOn: boolean;
};

const noSubscribe = () => () => undefined;

function readCache(): boolean {
  try {
    return window.localStorage.getItem(UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCache(open: boolean) {
  try {
    if (open) window.localStorage.setItem(UNLOCKED_KEY, "1");
    else window.localStorage.removeItem(UNLOCKED_KEY);
  } catch {
    // Private mode: the check simply runs again next time.
  }
}

async function readDevice(): Promise<Device> {
  const ua = navigator.userAgent;
  // iPadOS Safari reports a Mac user agent; touch points tell it apart.
  const ios =
    /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const mobile = ios || /Android/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Messenger/i.test(ua);
  const hasPush = "PushManager" in window && "serviceWorker" in navigator;
  const permission = "Notification" in window ? Notification.permission : "default";
  const support = pushSupport({ hasPush, isIos: ios, standalone, permission });
  let pushOn = false;
  if (support === "ready" && permission === "granted") {
    const registration = await navigator.serviceWorker.getRegistration();
    pushOn = Boolean(await registration?.pushManager.getSubscription());
  }
  return { mobile, ios, standalone, inApp, support, pushOn };
}

/**
 * Хранене opens once the club is on her home screen and notifications are on (see nutritionGate).
 * Until then a two-step card explains what to do on her device. A device that passed once shows the
 * diary at once next time and checks again in the background.
 */
export function NutritionGate({
  isAdmin,
  publicKey,
  pushHour,
  children,
}: {
  isAdmin: boolean;
  publicKey: string | null;
  pushHour: number | null;
  children: React.ReactNode;
}) {
  const [gate, setGate] = useState<NutritionGate | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  // Hydration-safe: the server (and the first client render) says false, then the stored flag.
  const cached = useSyncExternalStore(noSubscribe, readCache, () => false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    readDevice()
      .then((d) => {
        if (cancelled) return;
        const g = nutritionGate({
          isAdmin,
          mobile: d.mobile,
          standalone: d.standalone,
          inApp: d.inApp,
          pushKey: publicKey !== null,
          pushOn: d.pushOn,
          pushSupport: d.support,
        });
        writeCache(g.open);
        setDevice(d);
        setGate(g);
      })
      .catch(() => {
        // Detection failed (old browser): never lock her out of her own diary over it.
        if (!cancelled) setGate({ open: true, install: "n/a", push: "n/a" });
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, publicKey]);

  if (gate?.open || (gate === null && (cached || isAdmin))) return <>{children}</>;
  if (gate === null || device === null) {
    return (
      <div
        className="h-64 animate-pulse rounded-2xl bg-sand motion-reduce:animate-none"
        aria-busy="true"
      />
    );
  }

  async function turnOn() {
    if (!publicKey || pending) return;
    setPending(true);
    setError("");
    const result = await enablePush(publicKey, pushHour ?? 18);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const g = nutritionGate({
      isAdmin,
      mobile: device!.mobile,
      standalone: device!.standalone,
      inApp: device!.inApp,
      pushKey: true,
      pushOn: true,
      pushSupport: "ready",
    });
    writeCache(g.open);
    setGate(g);
  }

  const installDone = gate.install === "done" || gate.install === "n/a";
  return (
    <Card className="space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold">Отключи Хранене</h2>
        <p className="text-sm text-ink-soft">
          Калориите и дневникът работят от приложението на телефона ти, с напомняне да запишеш
          храненията. Две стъпки и си готова.
        </p>
      </div>

      {gate.install !== "n/a" && (
        <Step
          icon={<Smartphone size={20} aria-hidden="true" />}
          number={1}
          done={installDone}
          title="Добави I AM STRONG на началния екран"
        >
          {gate.install === "in_app" ? (
            <p>
              Отворила си сайта в Instagram или Facebook. Натисни ⋯ горе вдясно и избери „Отвори в
              браузъра“, после продължи оттам.
            </p>
          ) : gate.install === "todo" && device.ios ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Натисни „Сподели“ в Safari (квадратчето със стрелка; при нови iPhone е в менюто ⋯).
              </li>
              <li>Избери „Добави към началния екран“ → „Добави“.</li>
              <li>Отвори I AM STRONG от новата икона и влез в Хранене оттам.</li>
            </ol>
          ) : gate.install === "todo" ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>В Chrome натисни менюто ⋮ горе вдясно.</li>
              <li>Избери „Инсталиране на приложението“ или „Добавяне към началния екран“.</li>
              <li>Отвори I AM STRONG от новата икона и влез в Хранене оттам.</li>
            </ol>
          ) : (
            <p>Готово — приложението е на началния ти екран.</p>
          )}
        </Step>
      )}

      {gate.push !== "n/a" && (
        <Step
          icon={<Bell size={20} aria-hidden="true" />}
          number={gate.install === "n/a" ? 1 : 2}
          done={gate.push === "done"}
          title="Включи известията"
        >
          {gate.push === "blocked" ? (
            <p>
              Известията са забранени за сайта. Разреши ги от настройките на телефона (Настройки →
              Известия → I AM STRONG) и се върни тук.
            </p>
          ) : !installDone ? (
            <p>След първата стъпка тук ще се появи бутон за известията.</p>
          ) : (
            <div className="space-y-2">
              <p>
                Напомняме ти веднъж на ден да запишеш храненията. Можеш да смениш часа в Профил.
              </p>
              <Button size="md" className="w-full" disabled={pending} onClick={() => void turnOn()}>
                {pending ? "Момент…" : "Включи известията"}
              </Button>
              {error && (
                <p role="alert" className="text-sm font-semibold text-brick">
                  {error}
                </p>
              )}
            </div>
          )}
        </Step>
      )}
    </Card>
  );
}

function Step({
  icon,
  number,
  done,
  title,
  children,
}: {
  icon: React.ReactNode;
  number: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h3 className="flex items-center gap-3 font-semibold">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
            done ? "bg-moss text-white" : "bg-powder-chip text-rose-deep",
          )}
          aria-hidden="true"
        >
          {done ? <Check size={18} strokeWidth={3} /> : icon}
        </span>
        <span>
          <span className="sr-only">{done ? "Готово: " : `Стъпка ${number}: `}</span>
          {title}
        </span>
      </h3>
      {!done && <div className="text-sm text-ink-soft">{children}</div>}
    </section>
  );
}
