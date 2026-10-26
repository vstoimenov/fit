import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { brand } from "@/lib/brand";

/** Public-site footer. `instagramUrl` comes from the admin settings; null hides the link. */
export function SiteFooter({ instagramUrl }: { instagramUrl: string | null }) {
  const year = new Date().getFullYear();
  return (
    <footer id="site-footer" className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-6 py-12 lg:grid-cols-12 lg:px-10">
        <div className="flex flex-col gap-3 lg:col-span-5">
          <Logo size="md" />
          <p className="text-[15px] text-ink-soft">Аксения Михайлова · I AM STRONG</p>
          <a
            href={`mailto:${brand.supportEmail}`}
            className="w-fit text-[15px] font-semibold underline-offset-4 hover:underline"
          >
            {brand.supportEmail}
          </a>
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-[15px] font-semibold underline-offset-4 hover:underline"
            >
              Instagram
            </a>
          )}
        </div>
        <nav
          aria-label="Правна информация"
          className="flex flex-col gap-2 text-[15px] lg:col-span-4 lg:col-start-9"
        >
          <Link href="/terms" className="w-fit underline-offset-4 hover:underline">
            Общи условия
          </Link>
          <Link href="/privacy" className="w-fit underline-offset-4 hover:underline">
            Поверителност
          </Link>
          <Link href="/login" className="w-fit underline-offset-4 hover:underline">
            Вход
          </Link>
        </nav>
        <p className="text-sm text-ink-soft lg:col-span-12">© {year} I AM STRONG</p>
      </div>
    </footer>
  );
}
