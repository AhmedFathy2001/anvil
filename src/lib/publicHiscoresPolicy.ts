// How long an on-demand hiscores lookup (lib/publicHiscoresCard) stays good. Pure, so the TTL rule is
// testable without a database.
//
// A found player's numbers move while they play, but a Lookup is a glance, not a tracker: half an hour
// is fresh enough and turns a name typed by many people into one Jagex request. "Not on the hiscores"
// almost never changes within a day (a new account has to cross the ranking thresholds), and it is the
// answer a typo gets — so caching it long is what keeps a stream of misspellings off the budget.

export type PublicHiscoresOutcome = 'value' | 'unranked';

export const PUBLIC_HISCORES_TTL_MS: Record<PublicHiscoresOutcome, number> = {
  value: 30 * 60_000,
  unranked: 24 * 60 * 60_000,
};

/** Is a cached row of this outcome, fetched at `fetchedAt`, still good at `now`? */
export function isPublicHiscoresFresh(outcome: string, fetchedAt: string, now: number): boolean {
  const ttl = PUBLIC_HISCORES_TTL_MS[outcome as PublicHiscoresOutcome];
  const at = Date.parse(fetchedAt);
  if (!ttl || Number.isNaN(at)) return false;
  return now - at < ttl;
}
