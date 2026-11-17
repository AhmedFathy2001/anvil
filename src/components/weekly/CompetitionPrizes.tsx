import { formatGp } from '@/lib/adminEventsFormat';
import { parseWeeklyPrizes, totalPrizeGp } from '@/lib/weeklyPrizes';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

/**
 * What a competition pays, for the people in it: one chip per paying place and the pot. Nothing at
 * all when it pays nothing. The ladder is set by staff (components/WeeklyPrizeLadder); this only reads it.
 */
export default function CompetitionPrizes({ prizes, hunt = false }: { prizes: string | null; hunt?: boolean }) {
  const ladder = parseWeeklyPrizes(prizes);
  const places = ladder.places.filter((p) => p.gp > 0);
  if (places.length === 0) return null;
  const rules = [
    ladder.splitTies ? 'Tied places share their prizes.' : null,
    // A hunt's places are drops, so "gained nothing" has no meaning there.
    !hunt && !ladder.payZeroGain ? 'A place pays only to someone who gained something.' : null,
  ].filter(Boolean);
  return (
    <section className="mt-4 rounded-xl border border-gold/30 bg-gold/[0.05] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-gold">Prizes</h2>
        {places.length > 1 && <span className="text-xs text-text-muted">{formatGp(totalPrizeGp(ladder))} gp in all, paid from the clan coffer</span>}
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {places.map((p, i) => (
          <li key={i} className={`rounded-lg border px-3 py-1.5 text-sm ${i === 0 ? 'border-gold/50 bg-gold/10' : 'border-card-border bg-card-bg'}`}>
            <span className="text-text-muted">{ORDINALS[i] ?? `${i + 1}th`}</span>{' '}
            <span className={`font-semibold tabular-nums ${i === 0 ? 'text-gold' : 'text-foreground'}`}>{formatGp(p.gp)} gp</span>
          </li>
        ))}
      </ul>
      {rules.length > 0 && <p className="mt-2 text-xs text-text-dim">{rules.join(' ')}</p>}
    </section>
  );
}
