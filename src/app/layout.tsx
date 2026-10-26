import type { Metadata, Viewport } from "next";
import { Bad_Script, Manrope } from "next/font/google";
import { Suspense } from "react";
import { SwRegister } from "@/components/app/sw-register";
import { VisitBeacon } from "@/components/app/visit-beacon";
import { brand } from "@/lib/brand";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "800"],
  variable: "--font-manrope",
});

// Handwritten accent: only the logo's „Strong" and a few notes on the public site.
const script = Bad_Script({
  subsets: ["latin", "cyrillic"],
  weight: "400",
  variable: "--font-script",
});

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  icons: { apple: "/pwa-icon/180" },
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: brand.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" className={`${sans.variable} ${script.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Suspense>
          <VisitBeacon />
        </Suspense>
        <SwRegister />
      </body>
    </html>
  );
}
