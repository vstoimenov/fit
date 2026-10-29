"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { utcToZoned } from "@/lib/admin/time";
import { dayLabel } from "@/lib/studio/format";
import { canCancel, DROP_IN_PRICE_EUR } from "@/lib/studio/rules";
import type { MyBooking } from "@/server/studio/booking";
import type { StudioSession } from "@/server/studio/schedule";
import { bookAction, cancelAction, joinAction } from "@/app/zala/actions";
import { Button } from "@/components/ui/button";
import { JoinForm } from "./join-form";
import { StudioCalendar } from "./studio-calendar";

const when = (iso: string) => {
  const { date, time } = utcToZoned(iso);
  return `${dayLabel(date)}, ${time}`;
};

const LATE_WARNING =
  "Внимание: до началото остават по-малко от 6 часа и няма да можеш да откажеш. Да те запиша ли?";

/** Booking, cancelling and the sign-up that appears when a signed-out visitor picks a training. */
export function StudioClient({
  signedIn,
  sessions,
  upcoming,
  today,
}: {
  signedIn: boolean;
  sessions: StudioSession[];
  upcoming: MyBooking[];
  today: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [picked, setPicked] = useState<StudioSession | null>(null);
  const joinRef = useRef<HTMLDivElement>(null);

  async function book(session: StudioSession) {
    setBusyId(session.id);
    setNotice(null);
    const res = await bookAction(session.id);
    setBusyId(null);
    if (!res.ok) {
      setNotice({ tone: "error", text: res.message });
    } else {
      setNotice({
        tone: "ok",
        text: res.cardId
          ? `Записана си за ${when(session.startsAt)}. Едно посещение е взето от картата ти.`
          : `Записана си за ${when(session.startsAt)}. Еднократна — плащаш ${DROP_IN_PRICE_EUR} € на място.`,
      });
    }
    router.refresh();
  }

  function onBook(session: StudioSession) {
    if (!signedIn) {
      setPicked(session);
      requestAnimationFrame(() => joinRef.current?.scrollIntoView({ behavior: "smooth" }));
      return;
    }
    if (!canCancel(session.startsAt, new Date()) && !window.confirm(LATE_WARNING)) return;
    void book(session);
  }

  async function cancel(booking: MyBooking) {
    setBusyId(booking.id);
    const res = await cancelAction(booking.id);
    setBusyId(null);
    setNotice(
      res.ok
        ? { tone: "ok", text: "Отказа се. Посещението ти е върнато." }
        : { tone: "error", text: res.message },
    );
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "rounded-2xl bg-brick/10 p-4 font-semibold text-brick"
              : "rounded-2xl bg-sand p-4 font-semibold"
          }
        >
          {notice.text}
        </p>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Записана си</h2>
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-line"
              >
                <div>
                  <p className="font-semibold">{when(b.startsAt)}</p>
                  <p className="text-sm text-ink-soft">
                    {b.title} · {b.cardId ? "по картата" : `${DROP_IN_PRICE_EUR} € на място`}
                  </p>
                </div>
                {b.canCancel ? (
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={busyId !== null}
                    onClick={() => void cancel(b)}
                  >
                    {busyId === b.id ? "Момент…" : "Откажи"}
                  </Button>
                ) : (
                  <span className="max-w-36 text-right text-xs text-ink-soft">
                    Отказът е възможен до 6 часа преди началото
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="grafik" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold">График</h2>
        <StudioCalendar
          sessions={sessions}
          bookedIds={upcoming.map((b) => b.sessionId)}
          busyId={busyId}
          onBook={onBook}
          today={today}
        />
      </section>

      {!signedIn && picked && (
        <div ref={joinRef}>
          <JoinForm
            title={`Запиши се за ${when(picked.startsAt)}`}
            join={joinAction}
            onJoined={async () => {
              await book(picked);
              setPicked(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
