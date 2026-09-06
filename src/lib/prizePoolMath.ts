// What a board's prize pot adds up to.
//
// Split out of lib/prizePool, which counts sign-ups and so imports `@/db`. This is one line of
// addition that four pages and a Discord command all need, and a test of it should not need a
// connection string. Same split lib/cofferMath already makes from lib/coffer.
//
// lib/prizePool re-exports it, so importers do not need to know this file exists.

// Total displayed prize pool = host-added bonus + clan coffer contribution + entry fee × approved
// entries. Nulls (free event / no bonus / no coffer) read as 0.
//
// The coffer part is DERIVED from its ledger row rather than folded into `addedPrizePool` when it is
// set. Folding would have meant two numbers for one fact: cancel the pool and the event still claims
// the gp, or trim the added field and the ledger still says the money left. Reading it means the pool
// and the ledger cannot disagree, because there is only one of them.
export function computePrizePool(opts: {
  addedPrizePool: number | null;
  signupFee: number | null;
  approvedCount: number;
  cofferFunded?: number | null;
}): number {
  const added = opts.addedPrizePool ?? 0;
  const coffer = opts.cofferFunded ?? 0;
  const fees = (opts.signupFee ?? 0) * opts.approvedCount;
  return added + coffer + fees;
}
