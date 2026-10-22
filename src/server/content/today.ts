import { AppError } from "@/lib/app-error";
import { completionStats, regularSlotDates } from "@/lib/program/completion-stats";
import { toLocalDate, weekStrip, type WeekDay } from "@/lib/program/dates";
import { pickToday, type TodayPick } from "@/lib/program/pick-today";
import type { Level, WorkoutKind, WorkoutLite } from "@/lib/program/types";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

export const WORKOUT_COLUMNS =
  "id, title, description, kind, level, duration_min, focus, thumbnail_url, publish_at, starter_order, min_member_level" as const;

type WorkoutRow = Pick<
  Database["public"]["Tables"]["workouts"]["Row"],
  | "id"
  | "title"
  | "description"
  | "kind"
  | "level"
  | "duration_min"
  | "focus"
  | "thumbnail_url"
  | "publish_at"
  | "starter_order"
  | "min_member_level"
>;

export interface WorkoutSummary {
  id: string;
  title: string;
  description: string;
  kind: WorkoutKind;
  level: Level | null;
  durationMin: number;
  focus: string[];
  thumbnailUrl: string | null;
  publishAt: string | null;
  starterOrder: number | null;
  /** Points level needed to watch it; null = every member. */
  minMemberLevel: number | null;
}

export function toSummary(row: WorkoutRow): WorkoutSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    level: row.level,
    durationMin: row.duration_min,
    focus: row.focus,
    thumbnailUrl: row.thumbnail_url,
    publishAt: row.publish_at,
    starterOrder: row.starter_order,
    minMemberLevel: row.min_member_level,
  };
}

export interface TodayView {
  name: string;
  level: Level;
  /** The member's IANA timezone (drives „today“ and the date line). */
  timezone: string;
  hasAccess: boolean;
  pick: TodayPick;
  workout: WorkoutSummary | null;
  streak: number;
  week: WeekDay[];
  /** Days done this week, capped at `weekTarget`. */
  weekDone: number;
  /** Scheduled slot days this week (5 when none). */
  weekTarget: number;
  nextDropAt: string | null;
  doneTotal: number;
}

export async function getTodayView(
  db: TypedClient,
  userId: string,
  now = new Date(),
): Promise<TodayView> {
  const [profileRes, workoutsRes, completionsRes, accessRes] = await Promise.all([
    db
      .from("profiles")
      .select("name, level, timezone, starter_week_done_at")
      .eq("id", userId)
      .single(),
    // Explicit publish filter: RLS also lets admins read drafts and scheduled workouts.
    db
      .from("workouts")
      .select(WORKOUT_COLUMNS)
      .not("publish_at", "is", null)
      .lte("publish_at", now.toISOString()),
    db.from("workout_completions").select("workout_id, local_date").eq("user_id", userId),
    db.rpc("my_access"),
  ]);
  if (profileRes.error && profileRes.error.code !== "PGRST116") {
    throw new Error(`load profile failed: ${profileRes.error.message}`);
  }
  if (!profileRes.data) throw new AppError("NOT_FOUND", "Профилът не е намерен.");
  if (workoutsRes.error || completionsRes.error || accessRes.error) {
    throw new Error(
      `today view query failed: ${workoutsRes.error?.message ?? completionsRes.error?.message ?? accessRes.error?.message}`,
    );
  }

  const profile = profileRes.data;
  const workouts = workoutsRes.data.map(toSummary);
  const completions = completionsRes.data;
  const completedIds = new Set(completions.map((c) => c.workout_id));
  // Exclusive workouts are bonus library content: not today's pick, not a week slot.
  const plan = workouts.filter((w) => w.minMemberLevel === null);
  const lite: WorkoutLite[] = plan.map(({ id, kind, level, starterOrder, publishAt }) => ({
    id,
    kind,
    level,
    starterOrder,
    publishAt,
  }));

  const pick = pickToday({
    level: profile.level,
    hasAccess: accessRes.data === true,
    starterWeekDone: profile.starter_week_done_at !== null,
    now,
    workouts: lite,
    completedIds,
  });

  const today = toLocalDate(now, profile.timezone);
  const slotDates = regularSlotDates(plan, profile.level, profile.timezone);
  const completionDates = completions.map((c) => c.local_date);
  const stats = completionStats({ slotDates, completionDates, today });

  const { data: nextDropAt, error: nextDropError } = await db.rpc("next_drop_at", {
    p_level: profile.level,
  });
  if (nextDropError) throw new Error(`next drop failed: ${nextDropError.message}`);

  return {
    name: profile.name,
    level: profile.level,
    timezone: profile.timezone,
    hasAccess: accessRes.data === true,
    pick,
    workout: "workoutId" in pick ? (workouts.find((w) => w.id === pick.workoutId) ?? null) : null,
    streak: stats.streakDays,
    weekDone: stats.weekDone,
    weekTarget: stats.weekTarget,
    week: weekStrip(today, completionDates, slotDates),
    nextDropAt: nextDropAt ?? null,
    doneTotal: completions.length,
  };
}
