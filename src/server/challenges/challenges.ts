import { AppError } from "@/lib/app-error";
import {
  challengeStatus,
  dayDate,
  firstDayFor,
  progress as progressOf,
  tickableDays,
} from "@/lib/challenges/calendar";
import type { TypedClient } from "@/server/db/types";

const NO_ACCESS = "Нужен е активен абонамент.";
const NOT_FOUND = "Предизвикателството не е намерено.";
const NOT_JOINED = "Не си включена в предизвикателството.";
/** Generous cap: a few dozen challenges is the expected scale. */
const LIST_LIMIT = 200;

export type ChallengeStatus = "upcoming" | "running" | "ended";

export interface ChallengeProgress {
  done: number;
  total: number;
  finished: boolean;
}

export interface MemberChallengeItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  days: number;
  status: ChallengeStatus;
  /** Today's day number while running, otherwise null. */
  day: number | null;
  joined: boolean;
  participants: number;
  /** Null until she joins. */
  progress: ChallengeProgress | null;
}

export interface MemberChallengeList {
  /** Running now, the one ending first at the top. */
  running: MemberChallengeItem[];
  /** Not started yet, the one starting first at the top. */
  upcoming: MemberChallengeItem[];
  /** Ended challenges she took part in, the latest first. */
  joinedFinished: MemberChallengeItem[];
}

export interface ChallengeDayView {
  day: number;
  /** Calendar date of the day (YYYY-MM-DD, Sofia). */
  date: string;
  task: string;
  /** Null when the day has none or the workout is no longer published. */
  workout: { id: string; title: string } | null;
  done: boolean;
  /** She may tick or untick it right now (today or yesterday, from her first day, with an active plan). */
  tickable: boolean;
  /** The day is still ahead. */
  locked: boolean;
  /** The day came before she joined; it does not count for her. */
  beforeJoin: boolean;
  /** She finished this day's workout today. */
  workoutDoneToday: boolean;
}

export interface BoardRow {
  rank: number;
  name: string;
  ticked: number;
  isMe: boolean;
}

export interface ChallengeView {
  challenge: {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    days: number;
    published: boolean;
    status: ChallengeStatus;
    day: number | null;
    participants: number;
  };
  days: ChallengeDayView[];
  participation: { joinedOn: string; firstDay: number; showOnBoard: boolean } | null;
  progress: ChallengeProgress | null;
  board: BoardRow[];
  hasAccess: boolean;
}

export interface HomeChallenge {
  challenge: { id: string; title: string; days: number };
  day: number;
  task: string;
  tickable: boolean;
  done: boolean;
  /** How many other running challenges she is in. */
  more: number;
}

/**
 * The database refuses with Bulgarian messages (not joined, the day window, before her first day, ended,
 * lapsed plan): those reach her as they are. Anything else is a real failure.
 */
function throwWriteError(error: { code?: string; message?: string }, what: string): never {
  if (error.code === "42501") throw new AppError("INVALID", NO_ACCESS);
  if (error.code === "P0002") throw new AppError("NOT_FOUND", NOT_FOUND);
  if ((error.code === "22023" || error.code === "55006") && error.message)
    throw new AppError("INVALID", error.message);
  throw new Error(`${what} failed: ${error.message}`);
}

async function readAccess(db: TypedClient): Promise<boolean> {
  const { data, error } = await db.rpc("my_access");
  if (error) throw new Error(`read access failed: ${error.message}`);
  return data === true;
}

async function participantCounts(db: TypedClient, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.rpc("challenge_counts", { p_ids: ids });
  if (error) throw new Error(`challenge counts failed: ${error.message}`);
  return new Map(data.map((row) => [row.challenge_id, row.participants]));
}

/**
 * What she can see: published challenges (RLS already limits those to members with access) plus every one
 * she joined, even when it was unpublished or her plan lapsed. Ended challenges she did not join are left out.
 */
export async function listMemberChallenges(
  db: TypedClient,
  userId: string,
  today: string,
): Promise<MemberChallengeList> {
  const [rows, parts] = await Promise.all([
    db
      .from("challenges")
      .select("id, title, start_date, days, published")
      .order("start_date", { ascending: false })
      .limit(LIST_LIMIT),
    db.from("challenge_participants").select("challenge_id, joined_on").eq("user_id", userId),
  ]);
  if (rows.error) throw new Error(`list challenges failed: ${rows.error.message}`);
  if (parts.error) throw new Error(`list participation failed: ${parts.error.message}`);

  const joinedOn = new Map(parts.data.map((p) => [p.challenge_id, p.joined_on]));
  const visible = rows.data.filter((c) => c.published || joinedOn.has(c.id));

  const tickedBy = new Map<string, number>();
  if (joinedOn.size > 0) {
    const ticks = await db
      .from("challenge_ticks")
      .select("challenge_id")
      .eq("user_id", userId)
      .in("challenge_id", [...joinedOn.keys()]);
    if (ticks.error) throw new Error(`list ticks failed: ${ticks.error.message}`);
    for (const t of ticks.data)
      tickedBy.set(t.challenge_id, (tickedBy.get(t.challenge_id) ?? 0) + 1);
  }
  const counts = await participantCounts(
    db,
    visible.map((c) => c.id),
  );

  const list: MemberChallengeList = { running: [], upcoming: [], joinedFinished: [] };
  for (const c of visible) {
    const { status, day } = challengeStatus(c.start_date, c.days, today);
    const joined = joinedOn.get(c.id);
    const item: MemberChallengeItem = {
      id: c.id,
      title: c.title,
      startDate: c.start_date,
      endDate: dayDate(c.start_date, c.days),
      days: c.days,
      status,
      day,
      joined: joined !== undefined,
      participants: counts.get(c.id) ?? 0,
      progress:
        joined === undefined
          ? null
          : progressOf(firstDayFor(c.start_date, joined), c.days, tickedBy.get(c.id) ?? 0),
    };
    if (status === "running") list.running.push(item);
    else if (status === "upcoming") list.upcoming.push(item);
    else if (item.joined) list.joinedFinished.push(item);
  }
  const byEnd = (a: MemberChallengeItem, b: MemberChallengeItem) =>
    a.endDate.localeCompare(b.endDate) || a.startDate.localeCompare(b.startDate);
  list.running.sort(byEnd);
  list.upcoming.sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate),
  );
  list.joinedFinished.sort((a, b) => -byEnd(a, b));
  return list;
}

/**
 * One challenge with every day, her participation and the leaderboard. Null when she cannot see it:
 * unknown, unpublished and not hers, or published but her plan has lapsed and she never joined.
 */
export async function getChallengeView(
  db: TypedClient,
  userId: string,
  id: string,
  today: string,
): Promise<ChallengeView | null> {
  const found = await db
    .from("challenges")
    .select(
      "id, title, description, start_date, days, published, challenge_days(day, task, workout_id, workouts(id, title))",
    )
    .eq("id", id)
    .maybeSingle();
  if (found.error) throw new Error(`get challenge failed: ${found.error.message}`);
  const c = found.data;
  if (!c) return null;

  const [part, ticks, hasAccess, counts] = await Promise.all([
    db
      .from("challenge_participants")
      .select("joined_on, show_on_board")
      .eq("challenge_id", id)
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("challenge_ticks").select("day").eq("challenge_id", id).eq("user_id", userId),
    readAccess(db),
    participantCounts(db, [id]),
  ]);
  if (part.error) throw new Error(`get participation failed: ${part.error.message}`);
  if (ticks.error) throw new Error(`get ticks failed: ${ticks.error.message}`);
  // Admins can read drafts through RLS; in the member app a draft is hers only once she has joined it.
  if (!c.published && !part.data) return null;

  const dayRows = [...c.challenge_days].sort((a, b) => a.day - b.day);
  const workoutIds = dayRows.flatMap((d) => (d.workouts ? [d.workouts.id] : []));
  const [board, completions] = await Promise.all([
    db.rpc("challenge_board", { p_id: id }),
    workoutIds.length === 0
      ? Promise.resolve({ data: [] as { workout_id: string }[], error: null })
      : db
          .from("workout_completions")
          .select("workout_id")
          .eq("user_id", userId)
          .eq("local_date", today)
          .in("workout_id", workoutIds),
  ]);
  if (board.error) throw new Error(`challenge board failed: ${board.error.message}`);
  if (completions.error) throw new Error(`get completions failed: ${completions.error.message}`);

  const { status, day: todayDay } = challengeStatus(c.start_date, c.days, today);
  const firstDay = part.data ? firstDayFor(c.start_date, part.data.joined_on) : null;
  const doneDays = new Set(ticks.data.map((t) => t.day));
  const tickable = new Set(
    part.data && firstDay !== null && hasAccess
      ? tickableDays(c.start_date, c.days, firstDay, today)
      : [],
  );
  const doneWorkouts = new Set(completions.data.map((w) => w.workout_id));

  return {
    challenge: {
      id: c.id,
      title: c.title,
      description: c.description,
      startDate: c.start_date,
      endDate: dayDate(c.start_date, c.days),
      days: c.days,
      published: c.published,
      status,
      day: todayDay,
      participants: counts.get(id) ?? 0,
    },
    days: dayRows.map((d) => {
      const date = dayDate(c.start_date, d.day);
      return {
        day: d.day,
        date,
        task: d.task,
        workout: d.workouts ? { id: d.workouts.id, title: d.workouts.title } : null,
        done: doneDays.has(d.day),
        tickable: tickable.has(d.day),
        locked: date > today,
        beforeJoin: firstDay !== null && d.day < firstDay,
        workoutDoneToday: d.workouts ? doneWorkouts.has(d.workouts.id) : false,
      };
    }),
    participation:
      part.data && firstDay !== null
        ? { joinedOn: part.data.joined_on, firstDay, showOnBoard: part.data.show_on_board }
        : null,
    progress: firstDay === null ? null : progressOf(firstDay, c.days, doneDays.size),
    board: board.data.map((row) => ({
      rank: row.rank,
      name: row.display_name,
      ticked: row.ticked,
      isMe: row.is_me,
    })),
    hasAccess,
  };
}

/**
 * The home card: the running challenge she joined that ends first, with today's task. `more` counts her
 * other running challenges. Null when she is in none.
 */
export async function homeChallenge(
  db: TypedClient,
  userId: string,
  today: string,
): Promise<HomeChallenge | null> {
  const { data, error } = await db
    .from("challenge_participants")
    .select("joined_on, challenges(id, title, start_date, days)")
    .eq("user_id", userId);
  if (error) throw new Error(`home challenge failed: ${error.message}`);

  const running = data.flatMap((p) => {
    const c = p.challenges;
    if (!c) return [];
    const { status, day } = challengeStatus(c.start_date, c.days, today);
    return status === "running" && day !== null
      ? [{ c, day, joinedOn: p.joined_on, end: dayDate(c.start_date, c.days) }]
      : [];
  });
  if (running.length === 0) return null;
  running.sort(
    (a, b) =>
      a.end.localeCompare(b.end) ||
      a.c.start_date.localeCompare(b.c.start_date) ||
      a.c.id.localeCompare(b.c.id),
  );
  const pick = running[0];

  const [taskRow, tick, hasAccess] = await Promise.all([
    db
      .from("challenge_days")
      .select("task")
      .eq("challenge_id", pick.c.id)
      .eq("day", pick.day)
      .maybeSingle(),
    db
      .from("challenge_ticks")
      .select("day")
      .eq("challenge_id", pick.c.id)
      .eq("user_id", userId)
      .eq("day", pick.day)
      .maybeSingle(),
    readAccess(db),
  ]);
  if (taskRow.error) throw new Error(`home challenge task failed: ${taskRow.error.message}`);
  if (tick.error) throw new Error(`home challenge tick failed: ${tick.error.message}`);
  if (!taskRow.data) return null;

  const first = firstDayFor(pick.c.start_date, pick.joinedOn);
  return {
    challenge: { id: pick.c.id, title: pick.c.title, days: pick.c.days },
    day: pick.day,
    task: taskRow.data.task,
    tickable:
      hasAccess && tickableDays(pick.c.start_date, pick.c.days, first, today).includes(pick.day),
    done: tick.data !== null,
    more: running.length - 1,
  };
}

/** Joins a challenge (the database sets the join date; joining twice changes nothing). */
export async function joinChallenge(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.rpc("join_challenge", { p_id: id });
  if (error) throwWriteError(error, "join challenge");
}

/**
 * Ticks or unticks one day. The database enforces every rule (participant, plan, today or yesterday, from
 * her first day) and the first tick of a day earns the points. A tick that is already there, or an untick
 * of a day that is not ticked, changes nothing and is not an error.
 */
export async function setTick(
  db: TypedClient,
  userId: string,
  input: { id: string; day: number; done: boolean },
): Promise<void> {
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 60) {
    throw new AppError("INVALID", "Невалиден ден.");
  }
  if (input.done) {
    const { error } = await db
      .from("challenge_ticks")
      .insert({ challenge_id: input.id, user_id: userId, day: input.day });
    // Unique violation: a second tap on a day that is already ticked.
    if (error && error.code !== "23505") throwWriteError(error, "tick day");
    return;
  }
  const { error } = await db
    .from("challenge_ticks")
    .delete()
    .eq("challenge_id", input.id)
    .eq("user_id", userId)
    .eq("day", input.day);
  if (error) throwWriteError(error, "untick day");
}

/** Shows or hides her name on the leaderboard of a challenge she joined. */
export async function setBoardVisibility(
  db: TypedClient,
  userId: string,
  input: { id: string; show: boolean },
): Promise<void> {
  const { data, error } = await db
    .from("challenge_participants")
    .update({ show_on_board: input.show })
    .eq("challenge_id", input.id)
    .eq("user_id", userId)
    .select("challenge_id");
  if (error) throwWriteError(error, "set board visibility");
  if (data.length === 0) throw new AppError("INVALID", NOT_JOINED);
}
