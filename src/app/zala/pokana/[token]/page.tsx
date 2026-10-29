import { Suspense } from "react";
import { DISPLAY, EYEBROW, WRAP } from "@/components/site/styles";
import { ClaimForm } from "@/components/studio/claim-form";

export const metadata = { title: "Покана", robots: { index: false } };

/** The link Аксения sends a walk-in: she sets her own login and lands on her card. */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className={`${WRAP} max-w-lg py-12`}>
      <p className={`${EYEBROW} text-rose-deep`}>Тренировки на място</p>
      <h1 className={`${DISPLAY} mt-3 text-4xl`}>Виж картата си онлайн.</h1>
      <p className="mt-4 mb-8 leading-relaxed">
        Аксения те е добавила в графика. Избери имейл и парола и ще виждаш колко посещения ти
        остават и до кога важи картата.
      </p>
      <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
        <Claim params={params} />
      </Suspense>
    </main>
  );
}

async function Claim({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClaimForm token={token} />;
}
