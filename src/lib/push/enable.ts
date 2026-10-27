"use client";

import { subscribePushAction } from "@/app/app/profile/push-actions";
import { urlBase64ToUint8Array } from "./support";

export type EnablePushResult =
  { ok: true; endpoint: string } | { ok: false; message: string; denied?: true };

/**
 * Subscribes this device (the permission prompt appears now, on her tap) and saves it with the daily
 * reminder hour. Shared by the Профил card and the Хранене unlock screen.
 */
export async function enablePush(publicKey: string, hour: number): Promise<EnablePushResult> {
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const result = await subscribePushAction(subscription.toJSON(), hour);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, endpoint: subscription.endpoint };
  } catch {
    const denied = "Notification" in window && Notification.permission === "denied";
    return denied
      ? {
          ok: false,
          denied: true,
          message: "Известията са забранени за сайта в настройките на браузъра.",
        }
      : { ok: false, message: "Не успяхме да включим известията. Опитай отново." };
  }
}
