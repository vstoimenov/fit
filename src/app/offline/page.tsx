export const metadata = { title: "Няма връзка" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl font-extrabold">Няма връзка</h1>
      <p className="text-ink-soft">
        Провери интернета и опитай пак. Тренировките са видео и имат нужда от връзка.
      </p>
    </main>
  );
}
