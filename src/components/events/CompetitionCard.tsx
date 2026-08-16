import Link from 'next/link';
import EventTimer from '@/components/EventTimer';
import { hubKind } from '@/lib/hubKinds';
import { weeklyValueText } from '@/lib/eventsHub';
import type { HubKind } from '@/lib/eventsHub';
import type { EventCard } from '@/lib/eventCards';
import type { WeeklyCard } from '@/lib/weeklyCards';

/**
 * One competition, live or finished, board or week.
 *
 * The same shell for both on purpose. A clan can have two bingos and three Skill weeks running at
 * once and no one of them is the main event — so a week is not a row in a list beside a board's
 * card, it IS a card, with the same billing, the same leader line and the same countdown. What
 * changes per kind is the accent and the glyph: a grid of claimed tiles reads as a board at a
 * glance, seven day-bars read as a week, and that is what keeps a merged list from flattening into
 * one undifferentiated pile.
 */

interface Props {
  kind: HubKind;
  href: string;
  name: string;
  /** '5×5 · points' or 'Agility · XP' — the sub-line under the name. */
  shape: string;
  state: 'live' | 'upcoming' | 'past';
  startDate: string | null;
  endDate: string | null;
  /** '3 teams', '41 players', '30 entered'. */
  entrants: string;
  /** Leader while it runs, winner once done. */
  top: { name: string; text: string; color?: string; pct?: number } | null;
  chips?: string[];
  glyph?: React.ReactNode;
  /** The metric's own icon (a skill or boss sprite). Beats the kind's emoji when there is one. */
  iconUrl?: string | null;
  /** Hide the countdown — the week frame carries one for all of its cards. */
  hideTimer?: boolean;
}

const STATE = {
  live: { label: 'Live', cls: 'bg-accent-green/20 text-accent-green-light' },
  upcoming: { label: 'Soon', cls: 'bg-blue-500/15 text-blue-400' },
  past: { label: 'Done', cls: 'bg-card-border/70 text-text-muted' },
} as const;

export default function CompetitionCard({
  kind,
  href,
  name,
  shape,
  state,
  startDate,
  endDate,
  entrants,
  top,
  chips = [],
  glyph,
  iconUrl,
  hideTimer,
}: Props) {
  const meta = hubKind(kind);
  const badge = STATE[state];

  return (
    <Link
      href={href}
      style={{ ['--accent' as string]: meta.accent }}
      className={`group relative block overflow-hidden rounded-xl border border-card-border bg-card-bg transition-colors hover:border-gold/45 hover:bg-card-bg-hover ${
        state === 'past' ? 'opacity-90 hover:opacity-100' : ''
      }`}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: meta.accent }} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-base"
            style={{
              background: `color-mix(in srgb, ${meta.accent} 16%, transparent)`,
              borderColor: `color-mix(in srgb, ${meta.accent} 38%, transparent)`,
            }}
          >
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt="" className="h-5 w-5 object-contain" />
            ) : (
              meta.emoji
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: meta.accent }}>
              {meta.label}
            </div>
            <h3 className="mt-0.5 truncate text-[15px] font-bold">{name}</h3>
            <p className="mt-0.5 truncate text-[11.5px] text-text-muted">
              {shape} · {entrants}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wider ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        {(glyph || top) && (
          <div className="mt-3 flex items-center gap-3">
            {glyph}
            <div className="min-w-0 flex-1">
              {top ? (
                <>
                  <div className="flex items-baseline gap-2 text-[12.5px]">
                    {top.color && (
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: top.color }} />
                    )}
                    <span className="min-w-0 truncate">
                      <span className="text-text-muted">{state === 'past' ? 'won by ' : 'leading '}</span>
                      <b className="font-bold">{top.name}</b>
                    </span>
                    <span
                      className="ml-auto shrink-0 whitespace-nowrap font-mono text-[12.5px] font-bold"
                      style={{ color: top.color ?? meta.accent }}
                    >
                      {top.text}
                    </span>
                  </div>
                  {top.pct != null && (
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-brown-dark">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, top.pct))}%`, backgroundColor: top.color ?? meta.accent }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12.5px] text-text-muted">
                  {state === 'upcoming' ? 'Nobody has scored yet — it hasn’t started' : 'Nobody has scored yet'}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-card-border pt-2.5 text-[11.5px] text-text-muted">
          {!hideTimer && (startDate || endDate) && (
            <EventTimer startDate={startDate} endDate={endDate} className="text-[11.5px] text-text-muted" />
          )}
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-card-border bg-brown-dark/50 px-2 py-[2px] text-[10.5px]">
              {c}
            </span>
          ))}
          <span className="ml-auto font-bold text-gold-light opacity-0 transition-opacity group-hover:opacity-100">
            Open →
          </span>
        </div>
      </div>
    </Link>
  );
}

/* --------------------------------------------------------------------- glyphs --
   Each kind's signature. Small, cheap, and drawn from data the card already has. */

/** A board's claimed share, always as a 5×5 — a 7×7 reads as its proportion. */
export function BoardGlyph({ e }: { e: EventCard }) {
  // Share of TILES claimed, not of points: on a points board the denominator is a point total,
  // which drew a 27-of-25-claimed board as four lit cells.
  const pct = e.board.tiles > 0 ? Math.min(1, e.board.claimed / e.board.tiles) : 0;
  const done = Math.round(pct * 25);
  return (
    <div aria-hidden className="grid w-[70px] shrink-0 grid-cols-5 gap-[3px]">
      {Array.from({ length: 25 }, (_, i) => (
        <span
          key={i}
          className="aspect-square rounded-[2px] border"
          style={
            i < done
              ? { background: e.top?.color ?? 'var(--gold)', borderColor: e.top?.color ?? 'var(--gold)' }
              : { background: 'rgba(22,18,16,0.85)', borderColor: 'var(--card-border)' }
          }
        />
      ))}
    </div>
  );
}

/** A track: how far down the sequence the leader has reached. */
export function TrackGlyph({ e }: { e: EventCard }) {
  const pct = e.board.tiles > 0 ? Math.min(1, e.board.claimed / e.board.tiles) : 0;
  return (
    <div aria-hidden className="relative h-10 w-[70px] shrink-0">
      <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-brown-dark" />
      <span
        className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
        style={{ width: `${pct * 100}%`, background: e.top?.color ?? 'var(--gold)' }}
      />
      <span
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-background"
        style={{ left: `calc(${pct * 100}% - 6px)`, background: e.top?.color ?? 'var(--gold)' }}
      />
    </div>
  );
}

/** Rungs: the top of an individual leaderboard, which has no board to draw. */
export function LadderGlyph({ accent }: { accent: string }) {
  return (
    <div aria-hidden className="flex w-[70px] shrink-0 flex-col gap-[3px]">
      {[100, 84, 70, 58, 44].map((w) => (
        <span key={w} className="h-[5px] rounded-full opacity-80" style={{ width: `${w}%`, background: accent }} />
      ))}
    </div>
  );
}

/** The right picture for a board, by what the board actually is. */
export function boardGlyphFor(e: EventCard, accent: string) {
  if (e.mode === 'ladder') return <LadderGlyph accent={accent} />;
  if (e.mode === 'race') return <TrackGlyph e={e} />;
  return <BoardGlyph e={e} />;
}

/** Seven day-bars — what the clan did on each day of the week so far. */
export function WeekGlyph({ days, accent }: { days: number[]; accent: string }) {
  if (days.length === 0) return null;
  const max = Math.max(...days, 1);
  return (
    <div aria-hidden className="flex h-10 shrink-0 items-end gap-[3px]">
      {Array.from({ length: 7 }, (_, i) => {
        const v = days[i];
        const height = v == null ? 3 : Math.max(3, Math.round((v / max) * 40));
        return (
          <span
            key={i}
            className="w-[7px] rounded-t-[2px]"
            style={{ height, background: v == null ? 'rgba(61,50,38,0.85)' : accent, opacity: v == null ? 1 : 0.9 }}
          />
        );
      })}
    </div>
  );
}

export function weeklyTop(w: WeeklyCard) {
  return w.top ? { name: w.top.rsn, text: weeklyValueText(w.unit, w.top.value) } : null;
}
