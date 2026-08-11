import { isIndividualMode } from '@/lib/statTracking';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Progress toward a submission-backed COUNT tile (kill / PvP / item gain / diary / CA / drop pool …),
// honouring the tile's tracking mode. This is the counterpart of lib/statTracking for hiscores tiles:
// ONE definition of "how far along is this team", shared by the completion writer (lib/submissions),
// the over-submission guards (submissions route), the in-game progress the plugin renders
// (plugin/config route), and the web board's progress bars (hooks/useDropProgress).
//
//   Team Total — every member's submissions sum toward requiredAmount. The historical behaviour and
//                still the default: `tracking_mode` is 'team' unless an admin picked Solo, and most
//                tile kinds never expose the toggle at all.
//   Solo       — "any ONE member reaches the count": progress is the BEST SINGLE member's total, not
//                the team's sum. Two members with 5 kills each on a 10-kill solo tile are at 5/10,
//                not 10/10. Before this existed the editor's Solo button wrote `tracking_mode` and
//                nothing on the submission path ever read it, so a Solo tile silently behaved as a
//                team tile (mirroring the older solo≡individual bug on stat tiles).
//
// Attribution key is `creditPlayerId ?? playerId`: a captain uploading on someone's behalf sets
// creditPlayerId, so credit follows whoever did the work, not whoever pressed upload. Rows with
// neither (admin/captain uploads with no credit player) share one "unattributed" bucket instead of
// being dropped, so a manually-credited solo tile can still finish.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface CountedSubmission {
  playerId?: number | null;
  creditPlayerId?: number | null;
  amount: number;
}

// Bucket key for submissions we can't attribute to a player. Player ids are positive autoincrement
// rowids, so 0 can never collide with a real one.
export const UNATTRIBUTED_CREDIT = 0;

export function submissionCreditKey(s: CountedSubmission): number {
  return s.creditPlayerId ?? s.playerId ?? UNATTRIBUTED_CREDIT;
}

export interface CountProgress {
  /** Progress toward requiredAmount under the tile's mode — the team sum, or the best member's total. */
  current: number;
  /** Solo mode: the player `current` belongs to. Null in team mode, or when the best bucket is unattributed. */
  finisherPlayerId: number | null;
  /** The team's summed total regardless of mode — for display and the grandfather guard in lib/submissions. */
  teamTotal: number;
}

/**
 * Fold a tile's submissions (already filtered to ONE tile and ONE team) into its progress.
 * Pure — the server hands it DB rows, the board hands it the client's submission list, and both
 * get the same answer.
 */
export function countProgress(
  subs: CountedSubmission[],
  trackingMode: string | null | undefined,
): CountProgress {
  const teamTotal = subs.reduce((sum, s) => sum + s.amount, 0);
  if (!isIndividualMode(trackingMode)) {
    return { current: teamTotal, finisherPlayerId: null, teamTotal };
  }

  const byPlayer = new Map<number, number>();
  for (const s of subs) {
    const key = submissionCreditKey(s);
    byPlayer.set(key, (byPlayer.get(key) ?? 0) + s.amount);
  }
  let bestKey = UNATTRIBUTED_CREDIT;
  let best = 0;
  for (const [key, total] of byPlayer) {
    if (total > best) {
      best = total;
      bestKey = key;
    }
  }
  return {
    current: best,
    finisherPlayerId: bestKey === UNATTRIBUTED_CREDIT ? null : bestKey,
    teamTotal,
  };
}

/**
 * One member's own total on a tile — what a Solo tile measures the submitter against, so the
 * over-submission guards and the "3/10" the plugin shows are about YOUR count, not the team's.
 * `playerId` null (unattributed admin/captain upload) reads that shared bucket.
 */
export function memberProgress(subs: CountedSubmission[], playerId: number | null): number {
  const key = playerId ?? UNATTRIBUTED_CREDIT;
  return subs.reduce((sum, s) => (submissionCreditKey(s) === key ? sum + s.amount : sum), 0);
}
