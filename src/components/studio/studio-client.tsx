"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { utcToZoned } from "@/lib/admin/time";
import { dayLabel } from "@/lib/studio/format";
import { bookingSummary } from "@/lib/studio/confirm";
import { DROP_IN_PRICE_EUR, type CardKind } from "@/lib/studio/rules";
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

/** Booking, cancelling and the sign-up that appears when a signed-out visitor picks a training. */
export function StudioClient({
  signedIn,
  sessions,
  upcoming,
  today,
  needsContact = false,
  card = null,
}: {
  /** The card a booking would use (for the confirm step's „взема се 1 посещение“). */
  card?: { kind: CardKind; startsOn: string; endsOn: string; remaining: number } | null;
  signedIn: boolean;
  /** Signed in without a phone (e.g. via Google): ask for name and phone before the first booking. */
  needsContact?: boolean;
  sessions: StudioSession[];
  upcoming: MyBooking[];
  today: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [picked, setPicked] = useState<StudioSession | null>(null);
  // Derived on every render, not frozen in state: after she signs in on another page the same
  // component instance stays mounted, and an initial-state value would keep asking her to sign up.
  const [contactSaved, setContactSaved] = useState(false);
  const askContact = (!signedIn || needsContact) && !contactSaved;
  const [confirming, setConfirming] = useState<StudioSession | null>(null);
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
    if (askContact) {
      setPicked(session);
      requestAnimationFrame(() => joinRef.current?.scrollIntoView({ behavior: "smooth" }));
      return;
    }
    // One tap must not spend a visit by accident: say what happens and let her confirm.
    setConfirming(session);
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

      {askContact && picked && (
        <div ref={joinRef}>
          <JoinForm
            title={`Запиши се за ${when(picked.startsAt)}`}
            existingAccount={signedIn}
            join={joinAction}
            onJoined={async () => {
              setContactSaved(true);
              await book(picked);
              setPicked(null);
            }}
          />
        </div>
      )}
      {confirming && (
        <ConfirmSheet
          summary={bookingSummary(confirming, card, new Date())}
          busy={busyId !== null}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            await book(confirming);
            setConfirming(null);
          }}
        />
      )}
    </div>
  );
}

/** Bottom sheet: the training, what it costs, and the 6-hour warning, before anything is booked. */
function ConfirmSheet({
  summary,
  busy,
  onCancel,
  onConfirm,
}: {
  summary: { when: string; payment: string; late: boolean };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 pb-safe sm:rounded-3xl"
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          Потвърди записването
        </h2>
        <p className="font-semibold">{summary.when}</p>
        <p>{summary.payment}</p>
        {summary.late ? (
          <p className="rounded-2xl bg-brick/10 p-3 text-sm font-semibold text-brick">
            До началото остават по-малко от 6 часа: след записване няма да можеш да откажеш.
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Можеш да откажеш до 6 часа преди началото.</p>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>
            Назад
          </Button>
          <Button className="flex-1" onClick={() => void onConfirm()} disabled={busy}>
            {busy ? "Записвам…" : "Потвърди"}
          </Button>
        </div>
      </div>
    </div>
  );
}
