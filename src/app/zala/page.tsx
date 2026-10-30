import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { DISPLAY, EYEBROW, WRAP } from "@/components/site/styles";
import { MyCard } from "@/components/studio/my-card";
import { StudioHeader } from "@/components/studio/studio-header";
import { StudioMap } from "@/components/studio/studio-map";
import { PriceCards } from "@/components/studio/price-cards";
import { StudioClient } from "@/components/studio/studio-client";
import { buttonClass } from "@/components/ui/button";
import { utcToZoned } from "@/lib/admin/time";
import { cancelNotice, dayLabel } from "@/lib/studio/format";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";
import { getSiteFlags, getSiteLinks } from "@/server/site/content";
import { getStudioAddress } from "@/server/studio/address";
import { loadMyStudio } from "@/server/studio/booking";
import { ensureStudioSessions, listStudioSchedule } from "@/server/studio/schedule";

export const metadata = {
  title: "Тренировки на място",
  description:
    "Графикът на тренировките с Аксения в залата: свободни места, записване и твоята карта.",
};

export default async function StudioPage() {
  const [links, flags] = await Promise.all([getSiteLinks(), getSiteFlags()]);
  return (
    <>
      <Suspense fallback={<StudioHeader signedIn={false} />}>
        <Header />
      </Suspense>
      <main className={`${WRAP} max-w-3xl py-12 lg:py-16`}>
        <p className={`${EYEBROW} text-rose-deep`}>Тренировки на място</p>
        <h1 className={`${DISPLAY} mt-3 text-[40px] sm:text-6xl`}>Тренирай с Аксения в залата.</h1>
        <p className="mt-4 text-lg leading-relaxed">
          Избери ден в календара, запиши се с едно докосване и следи картата си тук.
        </p>
        <div className="mt-10">
          <PriceCards />
        </div>
        <div className="mt-10">
          <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
            <Studio />
          </Suspense>
        </div>
      </main>
      <SiteFooter
        instagramUrl={links.instagramUrl}
        year={flags.year}
        loginHref="/login?next=/zala"
      />
    </>
  );
}

async function Header() {
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <StudioHeader signedIn={Boolean(user)} />;
}

async function Studio() {
  await connection();
  // The weekly slots become dated trainings lazily: whoever opens the page first creates them.
  const service = createAdminSupabaseClient();
  await ensureStudioSessions(service);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date();
  const [sessions, my, address, contact] = await Promise.all([
    listStudioSchedule(supabase, now),
    user ? loadMyStudio(supabase, user.id, now) : null,
    getStudioAddress(service),
    user ? supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle() : null,
  ]);
  // Signed in with Google or through the online club without a phone: Аксения needs one.
  const needsContact = Boolean(user) && !contact?.data?.phone;
  const today = utcToZoned(now.toISOString()).date;
  return (
    <div className="space-y-10">
      {my ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Твоята карта</h2>
          <MyCard card={my.current} adjustments={my.adjustments} today={today} />
        </section>
      ) : (
        <p className="text-sm">
          Вече имаш профил?{" "}
          <Link href="/login?next=/zala" className={buttonClass("link")}>
            Влез
          </Link>
        </p>
      )}
      {my?.cancelled.map((b) => (
        <p
          key={b.id}
          role="status"
          className="rounded-2xl bg-brick/10 p-4 font-semibold text-brick"
        >
          {cancelNotice(b.startsAt)}
        </p>
      ))}
      <StudioClient
        signedIn={Boolean(user)}
        sessions={sessions}
        upcoming={my?.upcoming ?? []}
        today={today}
        needsContact={needsContact}
        card={my?.current && !my.current.voided ? my.current : null}
      />
      {my && my.past.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Минали посещения</h2>
          <ul className="space-y-1 text-sm text-ink-soft">
            {my.past.map((b) => {
              const { date, time } = utcToZoned(b.startsAt);
              return (
                <li key={b.id}>
                  {dayLabel(date)}, {time} · {b.title}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {address && <StudioMap address={address} />}
    </div>
  );
}
