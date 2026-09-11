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

// ── Is this roster push evidence of anything? ────────────────────────────────────────────────────
//
// The sync departs everyone the payload does not name, which makes "the client could not read the
// clan" and "sixty people left" the same request. They are not the same event, and the difference is
// not recoverable afterwards — a soft-delete of a whole roster costs every caller of `leftAt IS NULL`
// at once, and the roster is the source of truth for who is a member at all.
//
// So a push has to clear a bar before it is allowed to remove anybody. The bar is about the READ,
// not the clan: what follows asks whether the client plausibly saw the member list, and refuses when
// the honest answer is no.

/** Below this many active members a roster may shrink freely — see `rosterReadVerdict`. */
export const SHRINK_GUARD_MIN_ROSTER = 20;

/** How much of an established roster one sync may depart before it has to say so explicitly. */
export const MAX_SHRINK_FRACTION = 0.5;

export interface RosterReadFacts {
  /** Names the payload carried, before any filtering. */
  sent: number;
  /**
   * Names that survived `isPlausibleRsn` and de-duplication — the only ones the diff can match on.
   *
   * THE UNIT OF EVIDENCE, and the reason nothing here counts the raw array: unresolvable entries
   * ("#Player1404" placeholders, over-long junk) are dropped before the diff, so a payload of 144
   * unreadable names arrives non-empty and reduces to nothing. A guard counting `sent` would wave
   * through the exact shape it exists to stop.
   */
  resolved: number;
  /** Names dropped as unreadable. */
  skippedNames: number;
  /** Active, non-admin member seats the clan holds right now. */
  activeMembers: number;
  /** How many of those the payload does not name — what this sync would remove. */
  wouldDepart: number;
  /** The admin saw the count and confirmed it. Answers `shrink` only. */
  force?: boolean;
}

export type RosterReadRefusal =
  /** Nothing legible arrived. You cannot be in a clan and read none of it. */
  | { kind: 'empty' }
  /** More names failed to resolve than survived — a half-loaded list, not an exodus. */
  | { kind: 'mostly-unreadable' }
  /** Every name is real, but there are too few of them to believe. Overridable. */
  | { kind: 'shrink'; ceiling: number };

/**
 * Why this push must not be applied, or null to apply it.
 *
 * `empty` and `mostly-unreadable` are NOT overridable. `force` answers "I know this roster shrank",
 * which is a claim about the clan; those two are claims about the CLIENT, and a read that returned
 * nothing legible cannot be confirmed by the person who also could not see it. An admin who means to
 * clear a roster has the admin tools, where it is one deliberate act rather than a side effect of
 * logging in.
 */
export function rosterReadVerdict(facts: RosterReadFacts): RosterReadRefusal | null {
  // Nothing to protect: a clan with no active members cannot lose any, so an unreadable push is
  // merely useless rather than destructive, and the caller gets the ordinary empty-sync result.
  if (facts.activeMembers === 0) return null;

  if (facts.resolved === 0) return { kind: 'empty' };

  // Majority rule rather than a tuned threshold. A handful of genuinely unresolvable members is
  // normal and stays well under it; a broken read is never marginal — it resolves 8 of 144.
  if (facts.skippedNames > facts.resolved) return { kind: 'mostly-unreadable' };

  // THE PARTIAL READ, which neither check above can see. A client reporting only the members
  // currently ONLINE sends a payload that is neither empty nor unreadable — every name in it is
  // real — and it is the likeliest shape to arrive from a port that reached for the wrong list.
  // Nothing in the request distinguishes it from a mass kick, so this one asks and `force` answers.
  const ceiling = Math.floor(facts.activeMembers * MAX_SHRINK_FRACTION);
  if (!facts.force && facts.activeMembers >= SHRINK_GUARD_MIN_ROSTER && facts.wouldDepart > ceiling) {
    return { kind: 'shrink', ceiling };
  }

  return null;
}
