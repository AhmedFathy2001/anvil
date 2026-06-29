// Big, bold "total prize pool so far" banner. Pure presentational server component —
// the pool is computed upstream (lib/prizePool.ts). Renders nothing when the pool is 0
// so free events with no host bonus don't show an empty "0 gp" hero.
export default function PrizePoolHero({
  prizePool,
  signupFee,
  addedPrizePool,
  approvedCount,
}: {
  prizePool: number;
  signupFee: number | null;
  addedPrizePool: number | null;
  approvedCount: number;
}) {
  if (prizePool <= 0) return null;

  const fee = signupFee ?? 0;
  const added = addedPrizePool ?? 0;

  // Breakdown line: "12 entries × 5,000,000 gp + 50,000,000 gp added".
  const parts: string[] = [];
  if (fee > 0) {
    parts.push(`${approvedCount} ${approvedCount === 1 ? 'entry' : 'entries'} × ${fee.toLocaleString()} gp`);
  }
  if (added > 0) parts.push(`${added.toLocaleString()} gp added`);

  return (
    <div className="mb-6 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-6 text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">
        Total prize pool so far
      </div>
      <div className="mt-2 text-4xl sm:text-5xl font-extrabold text-gold tabular-nums leading-tight">
        {prizePool.toLocaleString()}
        <span className="ml-1.5 text-2xl sm:text-3xl font-bold align-baseline">gp</span>
      </div>
      {parts.length > 0 && (
        <div className="mt-2 text-xs text-text-muted">{parts.join('  +  ')}</div>
      )}
    </div>
  );
}
