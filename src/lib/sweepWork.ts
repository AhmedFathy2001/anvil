// How the stats sweep decides what to fetch.
//
// Its own file, and deliberately free of any database import: this is pure list arithmetic, and
// living in statHistory meant a test of it could not run without a connection string.
/**
 * One fetch per CHARACTER, however many clan seats it holds.
 *
 * The sweep's work list is keyed by SEAT, because that is what a competition row points at. A person
 * in ten clans holds ten seats for one character and Jagex has one page for it, so without this the
 * same RSN is requested ten times a tick and the same account row written ten times.
 *
 * Safe to collapse because every write downstream is account-level: `updateAccountOfSeat` and the
 * unranked quarantine both resolve a seat id to its account before writing, so any one of the merged
 * seats stands for all of them. The per-seat work rides in `bingo` and `weekly`, which carry their
 * own row ids and still fan out to every clan.
 *
 * Generic over the entry shape so the cron's own MemberWork type stays where it is used.
 */
export function mergeSeatsByAccount<
  T extends {
    accountId: number | null;
    fetchRsn: string;
    clanMemberId: number | null;
    staleKey: string;
    nextDueAt: string | null;
    rosterOnly: boolean;
    bingo: unknown[];
    weekly: unknown[];
  },
>(entries: Iterable<T>, normalize: (rsn: string) => string): T[] {
  const merged = new Map<string, T>();
  for (const entry of entries) {
    // The account when we know it; the RSN is the fallback, and it is the thing actually fetched.
    const key = entry.accountId != null ? `acc:${entry.accountId}` : `rsn:${normalize(entry.fetchRsn)}`;
    const seen = merged.get(key);
    if (!seen) {
      merged.set(key, entry);
      continue;
    }
    seen.bingo.push(...entry.bingo);
    seen.weekly.push(...entry.weekly);
    seen.staleKey = seen.staleKey <= entry.staleKey ? seen.staleKey : entry.staleKey;
    // A null due time means "due now", so it wins over any scheduled one.
    seen.nextDueAt =
      seen.nextDueAt === null || entry.nextDueAt === null
        ? null
        : seen.nextDueAt < entry.nextDueAt
          ? seen.nextDueAt
          : entry.nextDueAt;
    // Claimed by a competition in ANY clan makes them priority work everywhere, not roster filler.
    seen.rosterOnly = seen.rosterOnly && entry.rosterOnly;
    seen.clanMemberId = seen.clanMemberId ?? entry.clanMemberId;
  }
  return Array.from(merged.values());
}
