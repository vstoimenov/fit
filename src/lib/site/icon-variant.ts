/** Which home-screen app an icon is for: the member app or the owner's admin. */
export type IconVariant = "member" | "admin";

/**
 * Bump whenever the icon artwork changes. Phones cache the image by URL for a day and iOS keeps
 * whatever it fetched when the site was added to the home screen, so a changed design needs a
 * new URL to be seen at all.
 */
export const ICON_VERSION = "2";

export function iconVariant(value: string | null): IconVariant {
  return value === "admin" ? "admin" : "member";
}

export function iconUrl(size: 180 | 192 | 512, variant: IconVariant = "member"): string {
  const params = new URLSearchParams({ v: ICON_VERSION });
  if (variant === "admin") params.set("variant", "admin");
  return `/pwa-icon/${size}?${params.toString()}`;
}
