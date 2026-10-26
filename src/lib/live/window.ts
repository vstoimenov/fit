export const JOIN_OPENS_MIN_BEFORE = 15;

export interface LiveWindow {
  startsAt: string;
  durationMin: number;
}

export type LiveState = "upcoming" | "open" | "ended";

export function joinOpensAt(session: LiveWindow): Date {
  return new Date(Date.parse(session.startsAt) - JOIN_OPENS_MIN_BEFORE * 60_000);
}

export function endsAt(session: LiveWindow): Date {
  return new Date(Date.parse(session.startsAt) + session.durationMin * 60_000);
}

/** The door opens 15 minutes early and closes when the session ends. */
export function liveState(session: LiveWindow, now: Date): LiveState {
  if (now < joinOpensAt(session)) return "upcoming";
  if (now < endsAt(session)) return "open";
  return "ended";
}
