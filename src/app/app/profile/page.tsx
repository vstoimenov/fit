import { Camera, ChartLine, ChevronRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NutritionAnswersForm } from "@/components/nutrition/nutrition-answers-form";
import { HealthSyncCard } from "@/components/profile/health-sync-card";
import { PushCard } from "@/components/profile/push-card";
import { clientEnv } from "@/env";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GOALS, LEVEL_LABEL, PROBLEMS } from "@/lib/labels";
import { endNotice, subscriptionText } from "@/lib/subscription-text";
import { requireUser } from "@/server/auth/require-user";
import { getNutritionProfile } from "@/server/nutrition/diary";
import { ManageSubscriptionButton } from "./manage-subscription-button";
import { DeleteAccount, PersonalData } from "./profile-forms";
import { SignOutButton } from "./sign-out-button";

export const metadata = { title: "Профил" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const [
    { data: profile, error: profileError },
    { data: sub, error: subError },
    { data: hasAccess, error: accessError },
    nutrition,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "name, email, level, weight_kg, target_weight_kg, height_cm, goal, problems, phone, phone_call_consent, marketing_consent, push_hour",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end, provider, provider_customer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("my_access"),
    // The nutrition card must not take down Профил (account, subscription, data export).
    getNutritionProfile(supabase, user.id).catch((error: unknown) => {
      console.error(
        "profile nutrition skipped",
        { userId: user.id },
        error instanceof Error ? error.message : error,
      );
      return null;
    }),
  ]);
  const loadError = profileError ?? subError ?? accessError;
  if (loadError) throw new Error(`load profile failed: ${loadError.message}`);
  // my_access is the one access rule (also covers past_due grace, canceled-until-period-end, admins).
  const access = hasAccess === true;

  return (
    <main className="space-y-6 px-5 pt-8 lg:px-8">
      <header className="space-y-1">
        <h1 className="font-display text-[34px] leading-[1.05] tracking-[-0.02em] break-words">
          {profile?.name}
        </h1>
        <p className="break-words text-ink-soft">
          {profile?.email} · {profile ? LEVEL_LABEL[profile.level] : ""}
        </p>
      </header>

      <Link
        href="/app/progress"
        className="flex min-h-14 items-center gap-3 rounded-2xl p-4 ring-[1.5px] ring-inset ring-ink active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <ChartLine size={24} strokeWidth={2} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 font-extrabold">Прогрес</span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      </Link>

      <Link
        href="/app/progress/photos"
        className="flex min-h-14 items-center gap-3 rounded-2xl p-4 ring-[1.5px] ring-inset ring-ink active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Camera size={24} strokeWidth={2} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1 font-extrabold">Снимки на прогреса</span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      </Link>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {profile && (
          <PersonalData
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

        <div className="space-y-4">
          <Card className="space-y-2 p-5">
            <h2 className="font-semibold">Абонамент</h2>
            <p className="text-ink-soft">{subscriptionText(access, sub)}</p>
            {endNotice(sub) && <p className="text-ink-soft">{endNotice(sub)}</p>}
            {sub?.provider === "stripe" && sub.provider_customer_id && <ManageSubscriptionButton />}
            {(!access || sub?.provider === "manual") && (
              <Link
                href="/app/plan"
                className={buttonClass(access ? "secondary" : "primary", "md") + " mt-1 w-full"}
              >
                Виж плановете
              </Link>
            )}
          </Card>

          {nutrition && (
            <Card className="space-y-4 p-5">
              <h2 className="font-semibold">Хранене</h2>
              <NutritionAnswersForm initial={nutrition.answers} variant="secondary" />
            </Card>
          )}

          <PushCard
            pushHour={profile?.push_hour ?? null}
            publicKey={clientEnv.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? null}
          />
          <HealthSyncCard />

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold">Акаунт</h2>
            <div className="space-y-3">
              <a href="/api/me/export" className={buttonClass("secondary", "md") + " w-full"}>
                Изтегли моите данни
              </a>
              <SignOutButton />
            </div>
            <DeleteAccount />
          </Card>
        </div>
      </div>
    </main>
  );
}
