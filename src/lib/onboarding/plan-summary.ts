import {
  PROBLEM_LABEL,
  PROBLEMS,
  TIME_LABEL,
  type Goal,
  type Problem,
  type Time,
} from "@/lib/labels";
import type { Level } from "@/lib/program/types";

const HEADLINE: Record<Goal, string> = {
  lose_weight: "4 седмици към по-леката ти версия",
  tone: "4 седмици да стегнеш тялото",
  strength: "4 седмици към по-силната ти версия",
  energy: "4 седмици повече енергия",
};

const PER_WEEK: Record<Level, number> = { beginner: 3, advanced: 3, pro: 4 };

export function buildPlanSummary(p: {
  goal: Goal | null;
  problems: string[];
  time: Time | null;
  level: Level;
}) {
  const focus = p.problems
    .filter((x): x is Problem => (PROBLEMS as readonly string[]).includes(x))
    .map((x) => PROBLEM_LABEL[x]);
  return {
    headline: HEADLINE[p.goal ?? "strength"],
    perWeek: PER_WEEK[p.level],
    minutes: TIME_LABEL[p.time ?? "20-30"],
    focus: focus.length > 0 ? focus : ["Цяло тяло"],
  };
}
