import { AppError } from "@/lib/app-error";
import { challengeInputSchema, type ChallengeInput } from "@/lib/challenges/schema";
import type { TypedClient } from "@/server/db/types";

export interface AdminChallengeListItem {
  id: string;
  title: string;
  startDate: string;
  days: number;
  published: boolean;
  participants: number;
}

/** A challenge as the admin form edits it: the input shape plus what locks it. */
export interface AdminChallenge extends ChallengeInput {
  id: string;
  participants: number;
  /** Once someone has joined, the start date and the day count are fixed and it cannot be deleted. */
  hasParticipants: boolean;
}

export interface WorkoutOption {
  id: string;
  title: string;
}

const NOT_FOUND = "Предизвикателството не е намерено.";
const FORBIDDEN = "Нямаш достъп.";

/**
 * The RPCs refuse with Bulgarian messages (bounds, unpublished workout, the participant lock): those
 * reach the admin as they are. Anything else is a real failure.
 */
function throwWriteError(error: { code?: string; message?: string }, what: string): never {
  if (error.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
  if (error.code === "P0002") throw new AppError("NOT_FOUND", NOT_FOUND);
  if ((error.code === "22023" || error.code === "55006") && error.message)
    throw new AppError("INVALID", error.message);
  throw new Error(`${what} failed: ${error.message}`);
}

async function participantCounts(db: TypedClient, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.rpc("challenge_counts", { p_ids: ids });
  if (error) throw new Error(`challenge counts failed: ${error.message}`);
  return new Map(data.map((row) => [row.challenge_id, row.participants]));
}

/** Newest start first. A few dozen challenges is the expected scale, so the whole list is loaded. */
export async function listChallenges(db: TypedClient): Promise<AdminChallengeListItem[]> {
  const { data, error } = await db
    .from("challenges")
    .select("id, title, start_date, days, published")
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`list challenges failed: ${error.message}`);
  const counts = await participantCounts(
    db,
    data.map((row) => row.id),
  );
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    days: row.days,
    published: row.published,
    participants: counts.get(row.id) ?? 0,
  }));
}

export async function getChallenge(db: TypedClient, id: string): Promise<AdminChallenge | null> {
  const { data, error } = await db
    .from("challenges")
    .select(
      "id, title, description, start_date, days, published, challenge_days(day, task, workout_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`get challenge failed: ${error.message}`);
  if (!data) return null;
  const participants = (await participantCounts(db, [id])).get(id) ?? 0;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    startDate: data.start_date,
    days: data.days,
    published: data.published,
    tasks: [...data.challenge_days]
      .sort((a, b) => a.day - b.day)
      .map((row) => ({ task: row.task, workoutId: row.workout_id })),
    participants,
    hasParticipants: participants > 0,
  };
}

/**
 * Creates (no id) or updates a challenge together with its day rows, in one database call. The input is
 * validated against the bounds first; the database repeats every rule and enforces the participant lock.
 */
export async function saveChallenge(
  db: TypedClient,
  input: ChallengeInput & { id?: string },
): Promise<string> {
  const challenge = challengeInputSchema.parse(input);
  const { data, error } = await db.rpc("admin_save_challenge", {
    // The generated type has no null for the id; the function creates when it is null.
    p_id: (input.id ?? null) as string,
    p_title: challenge.title,
    p_description: challenge.description,
    p_start: challenge.startDate,
    p_days: challenge.days,
    p_published: challenge.published,
    p_tasks: challenge.tasks,
  });
  if (error) throwWriteError(error, "save challenge");
  return data;
}

export async function deleteChallenge(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.rpc("admin_delete_challenge", { p_id: id });
  if (error) throwWriteError(error, "delete challenge");
}

/** Workouts a day may point to: published now (the same rule as `can_watch`), by title. */
export async function listPublishedWorkouts(db: TypedClient): Promise<WorkoutOption[]> {
  const { data, error } = await db
    .from("workouts")
    .select("id, title")
    .not("publish_at", "is", null)
    .lte("publish_at", new Date().toISOString())
    .order("title")
    .limit(1000);
  if (error) throw new Error(`list workouts failed: ${error.message}`);
  return data;
}
