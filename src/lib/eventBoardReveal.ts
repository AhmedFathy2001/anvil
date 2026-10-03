/** Pure timing rule for the optional whole-board reveal, kept outside the cron for direct tests. */
export function boardRevealIsDue(
  event: {
    tilesRevealed: number | boolean | null;
    tilesRevealAt: string | null;
    endDate: string | null;
    forceEndedAt: string | null;
  },
  nowMs: number = Date.now(),
): boolean {
  if (event.tilesRevealed || !event.tilesRevealAt || event.forceEndedAt) return false;
  const revealMs = Date.parse(event.tilesRevealAt);
  if (!Number.isFinite(revealMs) || revealMs > nowMs) return false;
  const endMs = event.endDate ? Date.parse(event.endDate) : null;
  return endMs == null || !Number.isFinite(endMs) || endMs > nowMs;
}
