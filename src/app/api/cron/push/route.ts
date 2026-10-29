import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { isCronAuthorized, notifyPublishedWorkouts, sendReminders } from "@/server/push/jobs";
import { webPushTransport } from "@/server/push/send";
import { utcToZoned } from "@/lib/admin/time";
import { sendStudioWarnings } from "@/server/studio/warnings";

/** Hourly (Vercel Cron): daily reminders for this hour, „Нова тренировка" for fresh publishes, gym card nudges. */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"), serverEnv.CRON_SECRET)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const transport = webPushTransport(serverEnv);
  if (!transport) return NextResponse.json({ skipped: "web push not configured" });
  const admin = createAdminSupabaseClient();
  const now = new Date();
  const [workouts, reminders, studio] = await Promise.all([
    notifyPublishedWorkouts(admin, now, transport),
    sendReminders(admin, now, transport),
    sendStudioWarnings(admin, transport, utcToZoned(now.toISOString()).date),
  ]);
  return NextResponse.json({ at: now.toISOString(), workouts, reminders, studio });
}
