"use client";

import { EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import {
  detectInstallPlatform,
  INSTALL_PROMPT_KEY,
  installPromptDue,
  type InstallPlatform,
  type InstallPromptState,
} from "@/lib/app/install-prompt";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function remember(state: InstallPromptState) {
  try {
    localStorage.setItem(INSTALL_PROMPT_KEY, JSON.stringify(state));
  } catch {
    // Private mode: the note simply shows again next time.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sand">
        {icon}
      </span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );
}

/**
 * A one-time note on phones: add the club to the home screen (iPhone: share sheet; Android: the
 * browser's install prompt or its menu). It never shows inside the installed app, and „По-късно"
 * hides it for a week.
 */
export function InstallPrompt() {
  const [platform, setPlatform] = useState<InstallPlatform>("none");
  const [canInstall, setCanInstall] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(INSTALL_PROMPT_KEY);
    } catch {
      stored = null;
    }
    if (!installPromptDue(stored, Date.now())) return;
    const detected = detectInstallPlatform(navigator.userAgent, { standalone: isStandalone() });
    if (detected === "none") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      remember({ done: true });
      setPlatform("none");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    // A short pause, so the home screen has settled before the note slides up.
    const timer = window.setTimeout(() => setPlatform(detected), 1500);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (platform === "none") return null;

  const close = (state: InstallPromptState) => {
    remember(state);
    setPlatform("none");
  };
  const install = async () => {
    const event = deferred.current;
    if (!event) return close({ done: true });
    await event.prompt();
    const { outcome } = await event.userChoice;
    close(outcome === "accepted" ? { done: true } : { snoozedAt: Date.now() });
  };

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden"
    >
      <div className="mx-auto max-w-md space-y-4 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-rose-deep uppercase">
              {platform === "ios" ? "iPhone" : "Android"}
            </p>
            <h2 id="install-title" className="font-display text-xl leading-tight">
              Добави клуба на началния екран
            </h2>
          </div>
          <button
            type="button"
            onClick={() => close({ snoozedAt: Date.now() })}
            aria-label="Затвори"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-sand"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-ink-soft">
          Отваряш го с едно докосване като приложение, вкарваш храната си за секунди и получаваш
          известията на клуба.
        </p>

        {platform === "ios" ? (
          <ol className="space-y-2">
            <Step icon={<Share size={16} aria-hidden="true" />}>
              В Safari натисни <strong>Сподели</strong> (бутонът долу в средата).
            </Step>
            <Step icon={<SquarePlus size={16} aria-hidden="true" />}>
              Избери <strong>Добави към началния екран</strong> (Add to Home Screen).
            </Step>
            <Step icon={<span className="text-xs font-bold">3</span>}>
              Натисни <strong>Добави</strong>. Иконата I AM STRONG се появява при другите
              приложения.
            </Step>
          </ol>
        ) : canInstall ? (
          <p className="text-sm">Натисни „Инсталирай“ и потвърди. Отнема две секунди.</p>
        ) : (
          <ol className="space-y-2">
            <Step icon={<EllipsisVertical size={16} aria-hidden="true" />}>
              В Chrome отвори менюто <strong>⋮</strong> горе вдясно.
            </Step>
            <Step icon={<SquarePlus size={16} aria-hidden="true" />}>
              Избери <strong>Добавяне към началния екран</strong> или{" "}
              <strong>Инсталиране на приложението</strong>.
            </Step>
          </ol>
        )}

        <div className="flex gap-2">
          {platform === "android" && canInstall ? (
            <button type="button" onClick={install} className={buttonClass("primary", "md")}>
              Инсталирай
            </button>
          ) : (
            <button
              type="button"
              onClick={() => close({ done: true })}
              className={buttonClass("primary", "md")}
            >
              Разбрах
            </button>
          )}
          <button
            type="button"
            onClick={() => close({ snoozedAt: Date.now() })}
            className={buttonClass("secondary", "md")}
          >
            По-късно
          </button>
        </div>
      </div>
    </div>
  );
}
