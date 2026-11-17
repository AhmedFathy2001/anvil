// One quiet line for a member whose weekly activity streak is alive but has nothing in this week yet
// (lib/apexHomeSignals streakFor: `weeks` ends with the week in progress, `current` counts the run
// behind it). Pure, so the wording and the condition are tested without a database.

export function streakNudge(streak: { current: number; weeks: readonly boolean[] }): string | null {
  if (streak.current <= 0) return null;
  // The week in progress is the last one; with it already active there is nothing to nudge.
  if (streak.weeks.length === 0 || streak.weeks[streak.weeks.length - 1]) return null;
  return `Play in anything this week to keep your ${streak.current}-week streak.`;
}
