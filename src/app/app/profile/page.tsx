import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Sparkline } from "@/components/progress/sparkline";
import { buttonClass } from "@/components/ui/button";
import { GOALS, LEVEL_LABEL, PROBLEMS } from "@/lib/labels";
import { endNotice, subscriptionText } from "@/lib/subscription-text";
import { requireUser } from "@/server/auth/require-user";
import { ManageSubscriptionButton } from "./manage-subscription-button";
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
    { data: hasAccess, error: accessError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "name, email, level, weight_kg, target_weight_kg, height_cm, goal, problems, phone, phone_call_consent, marketing_consent",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("check_ins")
      .select("created_at, weight_kg, waist_cm")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end, provider, provider_customer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("my_access"),
  ]);
  const loadError = profileError ?? checkInsError ?? subError ?? accessError;
  if (loadError) throw new Error(`load profile failed: ${loadError.message}`);
  // Newest 30, charted oldest to newest.
  const recent = [...(checkIns ?? [])].reverse();
  const weights = recent.map((c) => c.weight_kg).filter((w): w is number => w !== null);
  const waists = recent.map((c) => c.waist_cm).filter((w): w is number => w !== null);

  // my_access is the one access rule (also covers past_due grace, canceled-until-period-end, admins).
  const access = hasAccess === true;

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
        <p className="text-ink-soft">{subscriptionText(access, sub)}</p>
        {endNotice(sub) && <p className="text-ink-soft">{endNotice(sub)}</p>}
        {sub?.provider === "stripe" && sub.provider_customer_id && <ManageSubscriptionButton />}
        {!access && (
          <Link href="/app/plan" className="font-semibold underline underline-offset-4">
            Виж плановете
          </Link>
        )}
      </section>

      {profile && (
        <ProfileForms
          name={profile.name}
          level={profile.level}
          answers={{
            goal: GOALS.find((g) => g === profile.goal) ?? "",
            problems: PROBLEMS.filter((p) => profile.problems.includes(p)),
            heightCm: profile.height_cm,
            weightKg: profile.weight_kg,
            targetWeightKg: profile.target_weight_kg,
            phone: profile.phone ?? "",
            phoneCallConsent: profile.phone_call_consent,
            marketingConsent: profile.marketing_consent,
          }}
        />
      )}

      <section className="space-y-3">
        <a href="/api/me/export" className={buttonClass("quiet", "md") + " w-full"}>
          Изтегли моите данни
        </a>
        <SignOutButton />
      </section>
    </main>
  );
}
