import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Sparkline } from "@/components/progress/sparkline";
import { buttonClass } from "@/components/ui/button";
import { LEVEL_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/auth/require-user";
import { ProfileForms } from "./profile-forms";
import { SignOutButton } from "./sign-out-button";

export const metadata = { title: "Профил" };

type SearchParams = Promise<{ saved?: string }>;

export default function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Profile searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { saved } = await searchParams;
  const { user, supabase } = await requireUser();
  const [
    { data: profile, error: profileError },
    { data: checkIns, error: checkInsError },
    { data: sub, error: subError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, email, level, weight_kg, target_weight_kg")
      .eq("id", user.id)
      .single(),
    supabase
      .from("check_ins")
      .select("created_at, weight_kg, waist_cm")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(30),
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (profileError || checkInsError || subError) {
    throw new Error(
      `load profile failed: ${(profileError ?? checkInsError ?? subError)?.message ?? "unknown"}`,
    );
  }
  const weights = (checkIns ?? []).map((c) => c.weight_kg).filter((w): w is number => w !== null);
  const waists = (checkIns ?? []).map((c) => c.waist_cm).filter((w): w is number => w !== null);

  return (
    <main className="space-y-8 px-5 pt-8">
      <header>
        <h1 className="font-display text-3xl font-bold break-words">{profile?.name}</h1>
        <p className="break-words text-ink-soft">
          {profile?.email} · {profile ? LEVEL_LABEL[profile.level] : ""}
        </p>
      </header>
      {saved && (
        <p className="rounded-2xl bg-moss/15 px-4 py-3 font-semibold text-moss">
          Прогресът е записан ✓
        </p>
      )}

      <section className="space-y-3 rounded-[1.75rem] bg-white p-5 ring-1 ring-line">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Тегло</h2>
          <p className="text-sm text-ink-soft">
            {weights.at(-1) ?? profile?.weight_kg ?? "—"} кг · цел{" "}
            {profile?.target_weight_kg ?? "—"} кг
          </p>
        </div>
        <Sparkline points={weights} label="Тегло във времето" />
        {waists.length > 1 && (
          <>
            <h2 className="pt-2 font-semibold">Талия</h2>
            <Sparkline points={waists} label="Талия във времето" />
          </>
        )}
        <Link href="/app/check-in" className={buttonClass("ghost", "md") + " w-full"}>
          Отбележи прогрес
        </Link>
      </section>

      <section className="space-y-2 rounded-[1.75rem] bg-white p-5 ring-1 ring-line">
        <h2 className="font-semibold">Абонамент</h2>
        <p className="text-ink-soft">
          {sub && ["active", "trialing"].includes(sub.status)
            ? "Активен"
            : "Нямаш активен абонамент"}
        </p>
        {!sub && (
          <Link href="/app/plan" className="font-semibold underline underline-offset-4">
            Виж плановете
          </Link>
        )}
      </section>

      {profile && <ProfileForms name={profile.name} level={profile.level} />}

      <section className="space-y-3">
        <a href="/api/me/export" className={buttonClass("quiet", "md") + " w-full"}>
          Изтегли моите данни
        </a>
        <SignOutButton />
      </section>
    </main>
  );
}
