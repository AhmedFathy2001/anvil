import { paidEntriesLabel } from '@/lib/entryFeeMath';

// Big, bold "total prize pool so far" banner. Pure presentational server component —
// the pool is computed upstream (lib/prizePool.ts). Renders nothing when the pool is 0
// so free events with no host bonus don't show an empty "0 gp" hero.
export default function PrizePoolHero({
  prizePool,
  signupFee,
  addedPrizePool,
  approvedCount,
  paidFeesGp,
}: {
  prizePool: number;
  signupFee: number | null;
  addedPrizePool: number | null;
  approvedCount: number;
  /** The fees actually in. Members, guests and hand-priced entries pay different amounts, so the
   *  breakdown only says "× fee" when that multiplication is true. */
  paidFeesGp?: number;
}) {
  if (prizePool <= 0) return null;

  const fee = signupFee ?? 0;
  const added = addedPrizePool ?? 0;

  // Breakdown line: "12 paid entries × 5,000,000 gp + 50,000,000 gp added". Only fees actually in count.
  const parts: string[] = [];
  const feesIn = paidFeesGp ?? fee * approvedCount;
  if (feesIn > 0) parts.push(paidEntriesLabel(approvedCount, feesIn, signupFee));
  if (added > 0) parts.push(`${added.toLocaleString()} gp added`);

  return (
    <div className="mb-6 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-6 text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">
        Total prize pool so far
      </div>
      <div className="mt-2 text-3xl sm:text-5xl font-extrabold text-gold tabular-nums leading-tight">
        {prizePool.toLocaleString()}
        <span className="ml-1.5 text-xl sm:text-3xl font-bold align-baseline">gp</span>
      </div>
      {parts.length > 0 && (
        <div className="mt-2 text-xs text-text-muted">{parts.join('  +  ')}</div>
      )}
    </div>
  );
}
