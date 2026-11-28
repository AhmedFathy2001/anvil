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
