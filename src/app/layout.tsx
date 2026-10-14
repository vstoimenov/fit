import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
});
const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
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
    <html lang="bg" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
