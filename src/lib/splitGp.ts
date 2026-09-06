// Dividing gp between people, exactly.
//
// Two places need it and both are money: a prize place shared by everyone who finished level, and a
// donation several people chipped into. Integer division leaves a remainder, and gp has no
// fractions — so the remainder is handed out a coin at a time from the top rather than dropped.
// Dropping it is how a 100m prize split three ways pays out 99,999,999 and the ledger stops
// balancing against the ladder that was advertised.
//
// Pure, and its own module so both callers share one answer instead of rounding differently.

/**
 * `total` split `ways` ways, largest shares first, summing to exactly `total`.
 *
 * 100 three ways is [34, 33, 33]. Nobody is short more than a single gp, and which of them gets the
 * extra is the order they were given in — the standings order for a prize, the order they were
 * picked for a donation.
 */
export function splitEvenly(total: number, ways: number): number[] {
  if (ways <= 0) return [];
  const pot = Math.max(0, Math.floor(total));
  const share = Math.floor(pot / ways);
  let remainder = pot - share * ways;
  return Array.from({ length: ways }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;
    return share + extra;
  });
}
