import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import { hubKind } from '@/lib/hubKinds';
import type { HubKind } from '@/lib/eventsHub';
import type { CompetitionRowSummary, RowWhen } from '@/lib/competitionRows';

/**
 * One competition as one row: board or week, running, scheduled or finished.
 *
 * Boards used to be small cards and weeklies a card inside a "This week" frame, so the same page
 * looked like two products and said "This week" once per competition. This is the one shape for
 * all of them (lib/competitionRows reduces either kind to it): what it is, its name, what is
 * measured and who is in, then the leader with the figure right beside the name, and when it ends.
 *
 * The whole row is one link: the title's anchor is stretched over the card, so there is a single
 * tab stop and the focus ring lands on the row. Anything else that can be pressed (`aside`, e.g.
 * "Opt out") sits above that stretched link.
 */

const STATE = {
  live: { label: 'Live', cls: 'bg-accent-green/20 text-accent-green-light', dot: 'bg-accent-green-light' },
  upcoming: { label: 'Upcoming', cls: 'bg-gold/15 text-gold', dot: 'border border-gold' },
} as const;

export default function CompetitionRow({
  row,
  when,
  dates,
  mine,
  aside,
}: {
  row: CompetitionRowSummary;
  /** When it ends or starts (lib/competitionRows rowWhen). */
  when?: RowWhen | null;
  /** Said in `when`'s place on a finished row: its dates. */
  dates?: React.ReactNode;
  /** The viewer is entered: says "You're in" unless `aside` already does. */
  mine?: boolean;
  /** A control that belongs to the row but is not the row's link. */
  aside?: React.ReactNode;
}) {
  const meta = hubKind(row.kind as HubKind);
  const chip = row.state === 'past' ? null : STATE[row.state];
  const past = row.state === 'past';

  return (
    <div
      className={`relative flex h-full flex-wrap items-start gap-x-3 gap-y-1.5 overflow-hidden rounded-xl border bg-card-bg py-3 pl-4 pr-3.5 transition-colors hover:bg-card-bg-hover has-[a:focus-visible]:border-gold has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-gold ${
        row.state === 'live' ? 'border-accent-green/40 hover:border-accent-green/70' : 'border-card-border hover:border-gold/45'
      }`}
    >
      {/* The kind's colour names the format; the words beside it say it too. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.accent, opacity: past ? 0.5 : 1 }} />

      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border text-base"
        style={{
          background: `color-mix(in srgb, ${meta.accent} 16%, transparent)`,
          borderColor: `color-mix(in srgb, ${meta.accent} 38%, transparent)`,
        }}
      >
        {row.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.pictureUrl} alt="" className="h-full w-full rounded-[7px] object-cover" />
        ) : row.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.iconUrl} alt="" className="h-5 w-5 object-contain" />
        ) : (
          meta.emoji
        )}
      </span>

      <div className="min-w-0 flex-1 basis-[200px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: meta.accent }}>
            {meta.label}
          </span>
          {chip && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-xs font-bold ${chip.cls}`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
              {chip.label}
            </span>
          )}
        </div>
        <h3 className="mt-0.5 text-[15px] font-bold leading-snug">
          <ClanLink href={row.href} className="line-clamp-2 break-words outline-none after:absolute after:inset-0 after:content-['']">
            {row.title}
          </ClanLink>
        </h3>
        {row.meta.length > 0 && <p className="mt-0.5 text-xs leading-snug text-text-muted">{row.meta.join(' · ')}</p>}
      </div>

      <div className="w-full min-w-0 pl-[52px] text-xs leading-snug sm:w-auto sm:max-w-[46%] sm:pl-0 sm:text-right">
        {row.leader ? (
          <p className="text-[13px]">
            <span className="text-text-muted">{row.leader.label} </span>
            {row.leader.color && (
              <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-baseline" style={{ backgroundColor: row.leader.color }} />
            )}
            <b className="break-words font-bold">{row.leader.name}</b>{' '}
            <span className="whitespace-nowrap font-mono font-bold" style={{ color: past ? 'var(--gold-light)' : meta.accent }}>
              {row.leader.figure}
            </span>
          </p>
        ) : (
          row.noLeader && <p className="text-[13px] text-text-muted">{row.noLeader}</p>
        )}
        {when ? (
          <p className="mt-0.5 text-text-muted">
            <span className="font-semibold text-foreground/85">{when.text}</span>
            {when.at && <LocalTime date={when.at} format="short" className="before:content-['_·_']" />}
          </p>
        ) : (
          dates && <p className="mt-0.5 text-text-muted">{dates}</p>
        )}
        {/* The viewer's own part, in the same place on every row: their team, clan or place where the
            row knows it, then a week's "You're in · Opt out" (or just "You're in"). */}
        {row.yours && <p className="mt-0.5 font-semibold text-accent-green-light">{row.yours}</p>}
        {row.standing && <p className="mt-0.5 font-semibold text-accent-green-light">{row.standing}</p>}
        {aside ? (
          <div className="relative z-10 mt-0.5 sm:flex sm:justify-end">{aside}</div>
        ) : (
          !row.yours && !row.standing && mine && <p className="mt-0.5 font-semibold text-accent-green-light">You’re in</p>
        )}
      </div>
    </div>
  );
}

/** Rows in a list: two columns when the page is wide and there is more than one to show. */
export function CompetitionRowList({ children, count }: { children: React.ReactNode; count: number }) {
  return <ul className={`grid gap-2.5 ${count > 1 ? 'lg:grid-cols-2' : ''}`}>{children}</ul>;
}
