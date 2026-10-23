"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatNumber } from "@/lib/nutrition/format";
import { ringDash } from "@/lib/nutrition/ring";
import type { Totals } from "@/lib/nutrition/day";

const SIZE = 168;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;

type Macros = Pick<Totals, "proteinG" | "carbsG" | "fatG">;

const MACRO_ROWS: { key: keyof Macros; label: string }[] = [
  { key: "proteinG", label: "Белтъчини" },
  { key: "carbsG", label: "Въглехидрати" },
  { key: "fatG", label: "Мазнини" },
];

/**
 * The day's calories as a ring that fills as she logs, with three thin macro bars under it. Without a
 * target there is nothing to fill towards: the ring stays empty and only the total is shown.
 */
export function CalorieRing({
  total,
  target,
  macros,
  macroTargets,
}: {
  total: number;
  /** kcal goal; null while her data is incomplete. */
  target: number | null;
  macros?: Macros;
  macroTargets?: Macros | null;
}) {
  const reduced = useReducedMotion() ?? false;
  const { circumference, offset } = ringDash(total, target, RADIUS);
  const diff = target ? Math.round(target - total) : 0;
  const over = target !== null && diff < 0;
  const label = target
    ? `${formatNumber(total)} от ${formatNumber(target)} ккал`
    : `${formatNumber(total)} ккал`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={label}
            className="-rotate-90"
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-sand"
            />
            <motion.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              className={over ? "stroke-rose-deep" : "stroke-powder"}
              strokeDasharray={circumference}
              initial={reduced ? false : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={reduced ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-3xl font-extrabold tracking-tight">{formatNumber(total)}</p>
            <p className="text-xs font-semibold text-ink-soft">
              {target ? `/ ${formatNumber(target)} ккал` : "ккал"}
            </p>
          </div>
        </div>
        {target !== null && (
          <p className="text-sm font-semibold" aria-live="polite">
            {over
              ? `над целта с ${formatNumber(-diff)}`
              : diff === 0
                ? "точно в целта"
                : `остават ${formatNumber(diff)}`}
          </p>
        )}
      </div>

      {macros && (
        <ul className="space-y-3">
          {MACRO_ROWS.map(({ key, label: macroLabel }) => {
            const value = macros[key];
            const goal = macroTargets?.[key] ?? null;
            const pct = goal ? Math.round(Math.min(1, value / goal) * 100) : null;
            return (
              <li key={key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-xs font-semibold">
                  <span>{macroLabel}</span>
                  <span className="text-ink-soft">
                    {formatNumber(value)}
                    {goal ? ` / ${formatNumber(goal)}` : ""} г
                  </span>
                </div>
                {pct !== null && (
                  <div
                    role="progressbar"
                    aria-label={macroLabel}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="h-1.5 overflow-hidden rounded-full bg-sand"
                  >
                    <div
                      className="h-full rounded-full bg-powder transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
