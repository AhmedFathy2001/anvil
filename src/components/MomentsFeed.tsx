import { MOMENT_EMOJI, momentSentence } from '@/lib/moments';
import type { MomentRow } from '@/lib/momentsStore';

/**
 * What actually happened — the pets, the drops, the deaths.
 *
 * None of it scores. That's the point: a scoreboard says who is winning and says nothing about the
 * twenty minutes somebody spent dying to the boss their tile wanted, the 99 that landed on the
 * Tuesday, or the 40M that fell out of a chest for a tile nobody had. Those are the things people
 * tell each other about afterwards, and until now the clan's Discord was the only place they existed.
 *
 * The same feed serves a board, a competition week and the clan itself — the rows are identical and
 * only the framing changes, so the caller supplies the heading and the line under it.
 *
 * Plugin-reported, so it covers whoever has it installed — the same caveat every live surface here
 * carries. A quiet feed means a quiet week or a clan that mostly plays without the plugin. Where the
 * feed is one panel among many an empty one is just clutter, so it renders nothing; where the reader
 * ASKED for it (a tab they clicked) silence needs explaining, which is what `emptyNote` is for.
 */
export default function MomentsFeed({
  moments,
  title = 'Moments',
  blurb = 'what happened while the board ran — pets, big drops and deaths. Nothing here scores.',
  emptyNote,
}: {
  moments: MomentRow[];
  title?: string;
  blurb?: string;
  emptyNote?: string;
}) {
  if (moments.length === 0 && !emptyNote) return null;

  return (
    <section className="mb-6">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
          {title}
        </h2>
        <span className="text-[11.5px] text-text-muted">{blurb}</span>
      </div>

      {moments.length === 0 && (
        <p className="rounded-xl border border-card-border bg-card-bg px-4 py-6 text-center text-[13px] text-text-muted">
          {emptyNote}
        </p>
      )}

      {moments.length > 0 && (
      <div className="divide-y divide-card-border/60 rounded-xl border border-card-border bg-card-bg px-4">
        {moments.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5 py-2 text-[13px]">
            <span aria-hidden className="text-base leading-none">
              {MOMENT_EMOJI[m.kind] ?? '⭐'}
            </span>
            <span className="min-w-0 flex-1 truncate text-text-muted">
              <b className="font-semibold text-foreground">{m.rsn}</b> {momentSentence(m)}
            </span>
            {detail(m) && <span className="shrink-0 text-[11px] text-text-muted/80">{detail(m)}</span>}
            <span className="shrink-0 font-mono text-[10.5px] text-text-muted">{when(m.occurredAt)}</span>
          </div>
        ))}
      </div>
      )}
    </section>
  );
}

/** The supporting fact, when there is one worth the space: how rare, how deep, how much. */
function detail(m: MomentRow): string | null {
  const bits: string[] = [];
  if (m.rarityDenominator && m.rarityDenominator >= 100) bits.push(`1 in ${m.rarityDenominator.toLocaleString()}`);
  if (m.kc && m.kc > 0) bits.push(`${m.kc.toLocaleString()} KC`);
  if (m.valueGp && m.valueGp >= 1_000_000) bits.push(`${(m.valueGp / 1_000_000).toFixed(1)}M`);
  return bits.length > 0 ? bits.join(' · ') : null;
}

function when(raw: string): string {
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
