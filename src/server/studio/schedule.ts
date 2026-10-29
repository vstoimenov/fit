import "server-only";

import { BOOKING_DAYS } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";

export interface StudioSession {
  id: string;
  title: string;
  startsAt: string;
  durationMin: number;
  capacity: number;
  booked: number;
  spotsLeft: number;
  cancelled: boolean;
}

/** Creates the coming two weeks of trainings from the weekly slots (service-role client). */
export async function ensureStudioSessions(service: TypedClient): Promise<void> {
  const { error } = await service.rpc("studio_ensure_sessions", { p_days: BOOKING_DAYS });
  if (error) throw new Error(`ensure studio sessions failed: ${error.message}`);
}

/** The bookable window: from now until BOOKING_DAYS ahead, soonest first. */
export async function listStudioSchedule(
  db: TypedClient,
  now = new Date(),
): Promise<StudioSession[]> {
  const { data, error } = await db.rpc("studio_schedule", {
    p_from: now.toISOString(),
    p_to: new Date(now.getTime() + BOOKING_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`load studio schedule failed: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.starts_at,
    durationMin: r.duration_min,
    capacity: r.capacity,
    booked: r.booked,
    spotsLeft: Math.max(r.capacity - r.booked, 0),
    cancelled: r.cancelled,
  }));
}
