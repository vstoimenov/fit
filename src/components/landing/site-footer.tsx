import { brand } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p className="font-display font-extrabold text-ink">{brand.name}</p>
        {/* Plain text until the legal pages exist; then these become <Link>s. */}
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>Политика за поверителност</li>
          <li>Общи условия</li>
          <li>
            <a
              href={`mailto:${brand.supportEmail}`}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              {brand.supportEmail}
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
