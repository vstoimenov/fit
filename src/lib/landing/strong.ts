/**
 * The I AM STRONG launch landing: the few values that drive its interactive parts.
 * Copy that the owner edits lives in the components; offer facts live here.
 */

/** Enrolment closes 21.11.2026 at 23:59 Sofia time (EET, UTC+2). */
export const ENROLMENT_CLOSES_AT = Date.UTC(2026, 10, 21, 21, 59, 0);

/** Founding seats still open. Update by hand while the launch runs. */
export const SEATS_LEFT = 50;
export const SEATS_TOTAL = 50;

export type Countdown = {
  open: boolean;
  days: number;
  hours: string;
  minutes: string;
  strip: string;
};

export function countdown(now: number, closesAt = ENROLMENT_CLOSES_AT): Countdown {
  const left = Math.max(0, closesAt - now);
  if (left === 0) {
    return { open: false, days: 0, hours: "00", minutes: "00", strip: "Записването е затворено" };
  }
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  return {
    open: true,
    days,
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    strip: `Записването затваря след ${days} ${days === 1 ? "ден" : "дни"} и ${hours} ч`,
  };
}

/** The answer under „Познаваш ли се?“ after she taps the lines that fit her (0–4). */
export function painMessage(picked: number): string {
  if (picked <= 0) {
    return "Не ти липсва воля. Липсва ти кратък план, който се побира в деня ти, и хора, които тренират до теб.";
  }
  if (picked >= 4) {
    return "И четирите. Тогава I AM STRONG е направен точно за теб: 20 минути, общ старт и хора до теб.";
  }
  return `Позна се в ${picked} от 4. Не ти липсва воля, липсва ти план, който се побира в деня ти.`;
}

export const REWARDS = [
  { level: 4, text: "20% отстъпка от следващия абонамент" },
  { level: 6, text: "Специалните нива с ексклузивни тренировки" },
  { level: 8, text: "Лична консултация с Аксения" },
  { level: 10, text: "6 месеца клуб безплатно" },
] as const;

export function levelView(raw: number) {
  const level = Number.isFinite(raw) ? Math.min(10, Math.max(1, Math.round(raw))) : 1;
  const rewards = REWARDS.map((r) => ({ ...r, unlocked: level >= r.level }));
  const best = [...rewards].reverse().find((r) => r.unlocked);
  const text = best
    ? `Отключваш: ${best.text.charAt(0).toLowerCase()}${best.text.slice(1)}.`
    : "Влизаш, тренираш, трупаш точки. Първата награда е на ниво 4.";
  return { level, rewards, text };
}

export function seatsLeft(raw: number, total = SEATS_TOTAL) {
  const left = Math.min(total, Math.max(0, Math.round(raw)));
  return { left, percent: Math.round((left / total) * 100) };
}
