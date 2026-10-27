import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { clientEnv, serverEnv } from "@/env";
import { DayNav } from "@/components/nutrition/day-nav";
import { DiaryView } from "@/components/nutrition/diary-view";
import { NutritionGate } from "@/components/nutrition/nutrition-gate";
import { MenuView } from "@/components/nutrition/menu-view";
import { NutritionAnswersForm } from "@/components/nutrition/nutrition-answers-form";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { cn } from "@/lib/cn";
import { showDayResult } from "@/lib/nutrition/day";
import { parseDayParam } from "@/lib/nutrition/day-param";
import { historyDayLabel } from "@/lib/nutrition/history-format";
import { openMenuDishes, type MenuDish } from "@/lib/nutrition/menu-format";
import { sofiaHour, sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { getDiaryDay, getNutritionProfile, recentFoods } from "@/server/nutrition/diary";
import { getMenuDay } from "@/server/nutrition/menu";

export const metadata = { title: "Хранене" };

// The AI estimate (a server action invoked from this page) can take ~20 s; Server Actions inherit the
// page's limit.
export const maxDuration = 30;

type SearchParams = Promise<{ day?: string; view?: string }>;

export default function NutritionPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Nutrition searchParams={searchParams} />
    </Suspense>
  );
}

async function Nutrition({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { day: rawDay, view } = await searchParams;
  const { user, supabase } = await requireUser();
  const today = sofiaToday();
  // The menu is for today only: `day` is ignored there.
  const menuView = view === "menu";
  const day = menuView ? today : parseDayParam(rawDay, today);
  // The diary reads run next to the profile one. The menu needs the profile first, so it starts the
  // moment the profile arrives, still alongside the diary reads: two round trips instead of three.
  const profilePromise = getNutritionProfile(supabase, user.id);
  const menuPromise =
    menuView || day === today
      ? profilePromise.then((p) =>
          // The answers form (below) takes precedence; the diary chips need access.
          (p.hasAccess && p.answers === null) || !(menuView || p.hasAccess)
            ? null
            : getMenuDay(supabase, user.id, today, p),
        )
      : Promise.resolve(null);
  const [profile, diary, recent, menuResult, member] = await Promise.all([
    profilePromise,
    menuView ? null : getDiaryDay(supabase, user.id, day),
    menuView ? null : recentFoods(supabase, user.id, 20),
    menuPromise.then(
      (menu) => ({ menu, error: null as unknown }),
      (error: unknown) => ({ menu: null, error }),
    ),
    // Role and reminder hour for the unlock card (the owner is never asked to install).
    supabase.from("profiles").select("role, push_hour").eq("id", user.id).single(),
  ]);
  const gate = {
    isAdmin: member.data?.role === "admin",
    publicKey: clientEnv.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? null,
    pushHour: member.data?.push_hour ?? null,
  };
  // Members with access unlock Хранене by adding the app to the home screen and turning reminders on;
  // without access the plans card below the read-only diary is what matters.
  const gated = (content: React.ReactNode) =>
    profile.hasAccess ? <NutritionGate {...gate}>{content}</NutritionGate> : content;

  // First visit: the questions come before the diary. Without access she cannot answer here (the plan
  // card below the read-only diary says why), so only members with access see the form.
  if (profile.hasAccess && profile.answers === null) {
    return (
      <main className="space-y-6 px-5 pt-8 lg:px-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl">Хранене</h1>
          <p className="text-ink-soft">Няколко въпроса, за да изчислим целта ти.</p>
          <p className="text-sm text-ink-soft">
            Отговорите и записите за храна са здравни данни — пазим ги само за твоите изчисления.
          </p>
        </header>
        {gated(<NutritionAnswersForm initial={null} submitLabel="Продължи" />)}
      </main>
    );
  }

  if (menuView) {
    if (menuResult.error) throw menuResult.error;
    const menu = menuResult.menu ?? (await getMenuDay(supabase, user.id, today, profile));
    return (
      <main className="space-y-6 px-5 pt-8 lg:px-8">
        <Header />
        {gated(
          <>
            <ViewTabs menuView />
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold tracking-tight">Днес</h2>
              <p className="text-xs font-semibold text-ink-soft">{historyDayLabel(today)}</p>
            </div>
            <MenuView data={menu} day={today} />
          </>,
        )}
      </main>
    );
  }

  // Today's open menu dishes become „От менюто“ chips in the add sheet. The diary works without them.
  let menuDishes: MenuDish[] = [];
  if (day === today && profile.hasAccess) {
    if (menuResult.error) {
      const error = menuResult.error;
      console.error(
        "diary: menu chips unavailable",
        error instanceof Error ? error.message : String(error),
      );
    } else if (menuResult.menu) {
      menuDishes = openMenuDishes(menuResult.menu.slots, menuResult.menu.eatenSlots);
    }
  }

  return (
    <main className="space-y-6 px-5 pt-8 lg:px-8">
      <Header />
      {gated(
        <>
          <ViewTabs menuView={false} />
          <DayNav day={day} today={today}>
            <DiaryView
              key={day}
              day={day}
              entries={diary?.entries ?? []}
              target={profile.target}
              canWrite={profile.hasAccess}
              showResult={showDayResult(day, today, sofiaHour())}
              aiEnabled={Boolean(serverEnv.ANTHROPIC_API_KEY)}
              recent={profile.hasAccess && recent ? recent : []}
              menuDishes={menuDishes}
            />
          </DayNav>
        </>,
      )}
    </main>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-display text-3xl">Хранене</h1>
      <Link
        href="/app/nutrition/history"
        className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Последните 30 дни
      </Link>
    </div>
  );
}

/** „Дневник“ / „Меню“: plain links, so the view lives in the URL and the back button works. */
function ViewTabs({ menuView }: { menuView: boolean }) {
  const tabs = [
    { label: "Дневник", href: "/app/nutrition", active: !menuView },
    { label: "Меню", href: "/app/nutrition?view=menu", active: menuView },
  ];
  return (
    <nav aria-label="Изглед" className="flex gap-1 rounded-full bg-sand p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            tab.active ? "bg-ink text-white" : "text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
