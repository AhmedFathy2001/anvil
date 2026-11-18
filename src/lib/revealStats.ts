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

/**
 * A CLOSED TILE STOPS COUNTING. Once a mission's timer runs out, or somebody else takes a
 * first-come tile, nothing a team does afterwards belongs to it. The completing team is frozen by
 * its completion; everyone else is frozen here: when the tile closes, each player's gain on it at
 * that moment is kept beside the announce capture (lib/revealStatsCapture captureCloseStats), under
 * one reserved key so the per-player entries above are untouched:
 *   { "_close": { [participantId]: gainAtClose } }
 * A tile closed before this existed has no record and reads as before.
 */
export const CLOSE_KEY = '_close';

export function closeGains(json: string | null | undefined): Record<string, number> | null {
  const parsed = parseRevealStats(json) as (Record<string, unknown> & { [CLOSE_KEY]?: unknown }) | null;
  const at = parsed?.[CLOSE_KEY];
  return at && typeof at === 'object' ? (at as Record<string, number>) : null;
}

/** A player's gain on a tile, held at what it was when the tile closed. */
export function gainAtClose(gain: number, close: Record<string, number> | null, participantId: number): number {
  const at = close?.[participantId];
  // A player with no entry joined after it closed: nothing of theirs counts on it.
  return close == null ? gain : typeof at === 'number' ? Math.min(gain, at) : 0;
}
