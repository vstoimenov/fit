/**
 * Consecutive scheduled workout slots the user completed, newest first.
 * A slot counts as done if she trained on any day from the slot until the next slot opens.
 * The newest slot does not break the streak while it is still open.
 */
export function computeStreak(input: {
  slotDates: string[];
  completionDates: string[];
  today: string;
}): number {
  const slots = [...new Set(input.slotDates)].filter((d) => d <= input.today).sort();
  const done = [...new Set(input.completionDates)];
  let streak = 0;
  for (let i = slots.length - 1; i >= 0; i--) {
    const start = slots[i]!;
    const end = slots[i + 1] ?? "9999-12-31";
    const hit = done.some((d) => d >= start && d < end);
    if (hit) streak++;
    else if (i === slots.length - 1) continue;
    else break;
  }
  return streak;
}
