// Where one person stands on a weekly board: their place, the field, and the gap to the person
// above. Pure (no `@/` imports), so the competition page (lib/competitionView) and the events list
// (lib/viewerWeeklyStandings) work it out in this one function and cannot disagree.

export interface PlaceEntry {
  rsn: string;
  gained: number;
}

export interface ViewerPlace {
  /** 1-based place on the board, which is already ordered best first (lib/weekly computeLeaderboard). */
  rank: number;
  /** Everyone on the board. */
  total: number;
  /** The viewer's own figure. */
  gained: number;
  /** The person directly above them, and how far ahead. Null at the top. */
  behind: { rsn: string; amount: number } | null;
  /** At the top: how far ahead of second place. Null when not first, or when nobody else is on it. */
  lead: number | null;
}

/**
 * `board` is ordered best first; `myRsns` holds the RSNs of the viewer's own entries. When the
 * viewer has several, the best placed one speaks for them, as the page's "you" strip does.
 */
export function viewerPlace(board: readonly PlaceEntry[], myRsns: ReadonlySet<string>): ViewerPlace | null {
  const i = board.findIndex((e) => myRsns.has(e.rsn));
  if (i < 0) return null;
  return {
    rank: i + 1,
    total: board.length,
    gained: board[i].gained,
    behind: i > 0 ? { rsn: board[i - 1].rsn, amount: board[i - 1].gained - board[i].gained } : null,
    lead: i === 0 && board.length > 1 ? board[0].gained - board[1].gained : null,
  };
}
