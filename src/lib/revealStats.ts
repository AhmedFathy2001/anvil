/**
 * MISSIONS COUNT FROM THE ANNOUNCE, NOT FROM THE EVENT START.
 *
 * A stat tile measures each player's gain over their event baseline. That's right for the board, but a
 * mission dropped at 9pm asking for "1 TFA KC" would otherwise complete on KC a player banked at noon,
 * before anyone knew the mission existed. So the moment a mission is announced, each player's standing
 * on its stat is captured (lib/revealStatsCapture) and only what they do AFTER that counts.
 *
 * Stored per tile as { [participantId]: { g, l } }:
 *   g — the tile gain they already had at the announce; subtracted from every later gain.
 *   l — their lifetime total at the announce; a milestone mission is out of reach for anyone at or
 *       past the goal by then, the same way the event baseline gates a milestone board tile.
 * A player with no entry (joined later, or no baseline yet) counts from their own baseline, which was
 * captured after the announce anyway. A tile with no capture at all (NULL) counts from the event start.
 *
 * Pure on purpose — no database import — so it is testable on its own.
 */
export type RevealStats = Record<string, { g: number; l: number }>;

export function parseRevealStats(json: string | null | undefined): RevealStats | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as RevealStats) : null;
  } catch {
    return null;
  }
}

/** What a player has done toward the tile since it was announced. */
export function gainSinceReveal(gain: number, stats: RevealStats | null, participantId: number): number {
  const at = stats?.[participantId];
  return at ? Math.max(0, gain - at.g) : gain;
}

/** False once the player was already at or past a milestone mission's goal when it was announced. */
export function eligibleSinceReveal(stats: RevealStats | null, participantId: number, goal: number): boolean {
  const at = stats?.[participantId];
  return !at || at.l < goal;
}
