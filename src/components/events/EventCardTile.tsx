import Link from 'next/link';
import type { EventCard } from '@/lib/eventCards';

/**
 * The event card, shared by the home page and the events index so the two can never disagree about
 * who's leading or by how much.
 */
export default function EventCardTile({ e }: { e: EventCard }) {
  const pct = e.top && e.top.total > 0 ? Math.min(100, Math.round((e.top.score / e.top.total) * 100)) : 0;
  const state =
    e.status === 'live'
      ? { label: 'Live', cls: 'bg-accent-green/20 text-accent-green-light' }
      : e.status === 'upcoming'
        ? { label: 'Soon', cls: 'bg-blue-500/15 text-blue-400' }
        : { label: 'Done', cls: 'bg-card-border/70 text-text-muted' };

  return (
    <Link
      href={`/events/${e.id}`}
      className={`block rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/45 ${
        e.status === 'past' ? 'opacity-85 hover:opacity-100' : ''
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="truncate text-[15px] font-bold">{e.name}</span>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wider ${state.cls}`}>
          {state.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-gold/20 bg-gold/15 px-2 py-[2.5px] text-[10.5px] text-gold-light">
          {e.shape}
        </span>
        {e.chips.map((c) => (
          <span
            key={c}
            className="rounded-full border border-card-border bg-brown-dark/50 px-2 py-[2.5px] text-[10.5px] text-text-muted"
          >
            {c}
          </span>
        ))}
      </div>

      {e.top && (
        <>
          <div className="mt-3 flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: e.top.color }} />
            <span className="min-w-0 truncate">
              {e.status === 'live' ? 'leading' : 'won by'} <b className="font-bold">{e.top.name}</b>
            </span>
            <span className="ml-auto shrink-0 whitespace-nowrap font-mono font-bold" style={{ color: e.top.color }}>
              {e.top.score.toLocaleString()}
              <span className="font-normal text-text-muted">
                /{e.top.total.toLocaleString()} {e.top.unit}
              </span>
            </span>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-brown-dark">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: e.top.color }} />
          </div>
        </>
      )}

      <p className="mt-2.5 text-[11.5px] text-text-muted">{e.foot}</p>
    </Link>
  );
}
