import { z } from "zod";
import { AppError } from "@/lib/app-error";
import { levelForPoints } from "@/lib/points/levels";
import type { TypedClient } from "@/server/db/types";

export const REWARD_LEVELS = [4, 8, 10] as const;
export type RewardLevel = (typeof REWARD_LEVELS)[number];

export interface RewardCandidate {
  userId: string;
  name: string;
  email: string;
  level: number;
  points: number;
  /** Reward levels (4/8/10) she has reached, with whether the owner has handed them out. */
  reached: Array<{ level: RewardLevel; given: boolean; givenAt: string | null }>;
}

interface ProfileLite {
  id: string;
  name: string;
  email: string;
}

interface GivenRow {
  user_id: string;
  level: number;
  given_at: string;
}

/** Pure part of `listRewardCandidates`: members at level 4+, highest level first, then most points. */
export function buildRewardCandidates(input: {
  totals: Map<string, number>;
  profiles: ProfileLite[];
  given: GivenRow[];
}): RewardCandidate[] {
  const givenAt = new Map(input.given.map((g) => [`${g.user_id}:${g.level}`, g.given_at]));
  const rows: RewardCandidate[] = [];
  for (const p of input.profiles) {
    const points = input.totals.get(p.id);
    if (points === undefined) continue;
    const level = levelForPoints(points);
    if (level < REWARD_LEVELS[0]) continue;
    rows.push({
      userId: p.id,
      name: p.name || p.email,
      email: p.email,
      level,
      points,
      reached: REWARD_LEVELS.filter((l) => l <= level).map((l) => {
        const at = givenAt.get(`${p.id}:${l}`) ?? null;
        return { level: l, given: at !== null, givenAt: at };
      }),
    });
  }
  return rows.sort((a, b) => b.level - a.level || b.points - a.points);
}

const PAGE = 1000;
const MAX_PAGES = 500;
const IN_CHUNK = 100;

/** Total points per member from the ledger the session can read (an admin sees every row). */
async function ledgerTotals(db: TypedClient): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  // Keyset pagination on the id: new awards landing mid-scan cannot shift pages or repeat a row.
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = db.from("points_ledger").select("id, user_id, points").order("id").limit(PAGE);
    if (after !== null) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(`load points ledger failed: ${error.message}`);
    for (const row of data) totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + row.points);
    if (data.length < PAGE) return totals;
    after = data[data.length - 1].id;
  }
  throw new Error("load points ledger failed: too many rows to scan");
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Members who reached level 4 or more, with which of the 4/8/10 rewards were handed out. */
export async function listRewardCandidates(db: TypedClient): Promise<RewardCandidate[]> {
  const totals = await ledgerTotals(db);
  const ids = [...totals.entries()]
    .filter(([, points]) => levelForPoints(points) >= REWARD_LEVELS[0])
    .map(([id]) => id);
  if (ids.length === 0) return [];
  const groups = chunks(ids, IN_CHUNK);
  const [profileResults, givenResults] = await Promise.all([
    Promise.all(groups.map((g) => db.from("profiles").select("id, name, email").in("id", g))),
    Promise.all(
      groups.map((g) =>
        db.from("rewards_given").select("user_id, level, given_at").in("user_id", g),
      ),
    ),
  ]);
  const profiles: ProfileLite[] = [];
  for (const res of profileResults) {
    if (res.error) throw new Error(`load reward members failed: ${res.error.message}`);
    profiles.push(...res.data);
  }
  const given: GivenRow[] = [];
  for (const res of givenResults) {
    if (res.error) throw new Error(`load given rewards failed: ${res.error.message}`);
    given.push(...res.data);
  }
  return buildRewardCandidates({ totals, profiles, given });
}

const FORBIDDEN = "Нямаш достъп.";
const rewardInput = z.object({
  level: z.union([z.literal(4), z.literal(8), z.literal(10)], {
    error: "Тази награда не се дава ръчно.",
  }),
  note: z.string().trim().max(300, "Бележката е до 300 знака.").optional(),
});

/** Marks a reward as handed out (keeps the first date) or takes the mark back. */
export async function setRewardGiven(
  db: TypedClient,
  userId: string,
  level: RewardLevel,
  given: boolean,
  note?: string,
): Promise<void> {
  const parsed = rewardInput.safeParse({ level, note });
  if (!parsed.success) throw new AppError("INVALID", parsed.error.issues[0].message);
  if (given) {
    const { error } = await db
      .from("rewards_given")
      .upsert(
        { user_id: userId, level: parsed.data.level, note: parsed.data.note || null },
        { onConflict: "user_id,level", ignoreDuplicates: true },
      );
    if (error?.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
    if (error) throw new Error(`give reward failed: ${error.message}`);
    return;
  }
  const { data, error } = await db
    .from("rewards_given")
    .delete()
    .eq("user_id", userId)
    .eq("level", parsed.data.level)
    .select("user_id");
  if (error?.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
  if (error) throw new Error(`take back reward failed: ${error.message}`);
  if (data.length > 0) return;
  // RLS hides rows from a non-admin on delete instead of failing: a row that is still there means refusal.
  const { data: still, error: readError } = await db
    .from("rewards_given")
    .select("user_id")
    .eq("user_id", userId)
    .eq("level", parsed.data.level)
    .maybeSingle();
  if (readError) throw new Error(`take back reward failed: ${readError.message}`);
  if (still) throw new AppError("FORBIDDEN", FORBIDDEN);
}

const adjustInput = z.object({
  points: z
    .number({ error: "Точките са цяло число." })
    .int("Точките са цяло число.")
    .refine((n) => n !== 0, "Точките не може да са 0.")
    .refine((n) => n >= -10000 && n <= 10000, "Точките са между −10000 и 10000."),
  reason: z.string().trim().min(1, "Напиши причина.").max(200, "Причината е до 200 знака."),
});

/** Manual correction of a member's points (positive or negative), always with a reason. */
export async function adjustPoints(
  db: TypedClient,
  userId: string,
  points: number,
  reason: string,
): Promise<void> {
  const parsed = adjustInput.safeParse({ points, reason });
  if (!parsed.success) throw new AppError("INVALID", parsed.error.issues[0].message);
  const { error } = await db.rpc("admin_adjust_points", {
    p_user_id: userId,
    p_points: parsed.data.points,
    p_reason: parsed.data.reason,
  });
  if (error?.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
  if (error?.code === "22023") throw new AppError("INVALID", "Невалидна корекция.");
  if (error?.code === "P0002") throw new AppError("NOT_FOUND", "Клиентката не е намерена.");
  if (error) throw new Error(`adjust points failed: ${error.message}`);
}
