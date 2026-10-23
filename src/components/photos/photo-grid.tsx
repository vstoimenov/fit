import Link from "next/link";
import type { ProgressPhoto } from "@/server/progress/photos";

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** `takenOn` is a calendar day (YYYY-MM-DD); format it as UTC so no time zone can shift it. */
function formatDay(takenOn: string): string {
  return dateFormat.format(new Date(`${takenOn}T00:00:00Z`));
}

export function PhotoGrid({ photos }: { photos: ProgressPhoto[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 lg:grid-cols-4">
      {photos.map((photo) => {
        const day = formatDay(photo.takenOn);
        return (
          <li key={photo.id}>
            <Link
              href={`/app/progress/photos/${photo.id}`}
              className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-sand">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URLs; nothing to optimise against
                  <img
                    src={photo.url}
                    alt={`Снимка от ${day}`}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center px-1 text-center text-xs text-ink-soft">
                    Неналична
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{day}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
