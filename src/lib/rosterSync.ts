// What an in-game roster push actually has to WRITE.
//
// The plugin sends a roster whenever an admin's clan channel loads, which on a busy clan is many
// times a day. Every existing member used to be written on every one of those — two UPDATEs each,
// one of them the wide `accounts` row — to set the values they already held. Production showed it
// plainly: every seat in the clan carried the identical update count, because each sync rewrote the
// whole roster.
//
// A roster asserts three things that can change: who is in the clan, what rank they hold, and what
// they are called. When none of them moved, the row is already right and the sync is a read.
//
// Pure (no `@/db`) so the rule is unit-testable and lives in one place rather than inline in the
// route, where "is this different?" was never asked at all.

/** The subset of a seat + its account that a roster push can change. */
export interface RosterFacts {
  rsn: string;
  rsnNormalized: string;
  accountHash: string | null;
  previousRsns: string | null;
  rank: string | null;
  kind: string;
  source: string;
  leftAt: string | null;
}

/** True when the roster's view of the ACCOUNT differs from what is stored. */
export function accountChanged(stored: RosterFacts, next: RosterFacts): boolean {
  return (
    stored.rsn !== next.rsn ||
    stored.rsnNormalized !== next.rsnNormalized ||
    (stored.accountHash ?? null) !== (next.accountHash ?? null) ||
    (stored.previousRsns ?? null) !== (next.previousRsns ?? null)
  );
}

/** True when the roster's view of the SEAT differs from what is stored. */
export function seatChanged(stored: RosterFacts, next: RosterFacts): boolean {
  return (
    (stored.rank ?? null) !== (next.rank ?? null) ||
    (stored.leftAt ?? null) !== (next.leftAt ?? null) ||
    stored.kind !== next.kind ||
    stored.source !== next.source
  );
}

/**
 * Whether `last_seen_in_clan` is recent enough to leave alone.
 *
 * The one field an otherwise-unchanged sync still wants to move: a member the roster keeps reporting
 * IS still being seen. It is read as a date on a profile, so refreshing it hourly rather than on
 * every push costs a reader nothing and is the difference between one write per member per sync and
 * one per member per hour. A row that has never been stamped is never fresh.
 */
export function lastSeenIsFresh(
  lastSeenInClan: string | null | undefined,
  nowIso: string,
  refreshMs: number,
): boolean {
  if (!lastSeenInClan) return false;
  const seen = Date.parse(lastSeenInClan);
  const now = Date.parse(nowIso);
  if (Number.isNaN(seen) || Number.isNaN(now)) return false;
  // A stamp in the future is a clock skew, not a reason to write; treat it as fresh.
  return seen > now - refreshMs;
}
