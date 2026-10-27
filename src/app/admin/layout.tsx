import type { Metadata } from "next";
import { iconUrl } from "@/lib/site/icon-variant";

/** Every /admin page (panel and MFA) presents the admin home-screen app, not the member one. */
export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon", type: "image/png", sizes: "64x64" }],
    apple: iconUrl(180, "admin"),
  },
  appleWebApp: { capable: true, title: "Админ", statusBarStyle: "default" },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
