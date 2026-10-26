export type PushSupport = "ready" | "ios_install" | "denied" | "unsupported";

/**
 * What the notifications card can offer on this device. iPhone and iPad run Web Push only from
 * the home-screen app (iOS 16.4+), so a Safari tab there gets the install hint, not "unsupported".
 */
export function pushSupport(input: {
  hasPush: boolean;
  isIos: boolean;
  standalone: boolean;
  permission: NotificationPermission;
}): PushSupport {
  if (input.hasPush && input.permission === "denied") return "denied";
  if (input.hasPush) return "ready";
  if (input.isIos && !input.standalone) return "ios_install";
  return "unsupported";
}

/** The VAPID public key as `applicationServerKey` (URL-safe base64 → bytes). */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
