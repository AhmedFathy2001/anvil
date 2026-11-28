// When results may settle: every entrant read from the hiscores after the end, or the wait is over.
// Pure: the weekly finish (lib/weeklyFinish), the bingo end post (lib/eventLifecycle) and the tests.

/** How long results wait for every entrant's after-the-end read before settling with what they have. */
export const FINAL_READ_WAIT_MS = 2 * 60 * 60 * 1000;

/** A competition's results may settle: nobody left to read, or the 2-hour wait is over. */
export function finalReadsDone(remaining: number, endMs: number, nowMs: number): boolean {
  return remaining <= 0 || !Number.isFinite(endMs) || nowMs - endMs >= FINAL_READ_WAIT_MS;
}

/** A board's end post may go out without its final reads: nothing to read, or the wait is over. */
export function eventReadsDone(hasStatTiles: boolean, endMs: number, nowMs: number): boolean {
  return !hasStatTiles || !Number.isFinite(endMs) || nowMs - endMs >= FINAL_READ_WAIT_MS;
}

/** A read this long after the end has likely caught play after it: a pre-end plugin reading wins over it. */
export const LATE_READ_MS = 15 * 60 * 1000;

/**
 * The plugin's live readings as they stood at the end. A key whose last rise was at or before the end
 * still holds its end value; one that rose after it (or has no time) is contaminated: its value at the
 * end is unknown from the overlay alone, and a late hiscores read of it carries play after the end.
 */
export function liveAtEnd(
  live: Record<string, number>,
  keyTimes: Record<string, string> | null | undefined,
  endMs: number,
): { atEnd: Record<string, number>; rose: string[] } {
  const atEnd: Record<string, number> = {};
  const rose: string[] = [];
  for (const [k, v] of Object.entries(live)) {
    const t = keyTimes?.[k] ? Date.parse(keyTimes[k]) : NaN;
    if (Number.isFinite(t) && t <= endMs) atEnd[k] = v;
    else rose.push(k);
  }
  return { atEnd, rose };
}

/** liveAtEnd's values alone: what the overlay vouches for at the end. */
export function liveBefore(live: Record<string, number>, keyTimes: Record<string, string> | null | undefined, endMs: number): Record<string, number> {
  return liveAtEnd(live, keyTimes, endMs).atEnd;
}

/**
 * Take a post-end hiscores read as the final reading? A prompt one (within LATE_READ_MS of the end),
 * yes. A late one only when the plugin has nothing to say: no reading as at the end to prefer, and no
 * reading that rose after the end (which shows play after it that the late read would carry).
 */
export function takeLateRead(lagMs: number, hasPreEndLive: boolean, roseAfterEnd = false): boolean {
  return lagMs <= LATE_READ_MS || (!hasPreEndLive && !roseAfterEnd);
}

/** event_participants.end_live as stored: a map of numbers, or null when none was captured. */
export function parseEndLive(json: string | null | undefined): Record<string, number> | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1])));
  } catch {
    return null;
  }
}
