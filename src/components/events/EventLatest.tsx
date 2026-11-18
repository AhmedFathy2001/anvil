import type { ReactNode } from 'react';

import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import type { LatestLine, LatestTag } from '@/lib/eventLatest';

/**
 * The Board tab's short "Latest" strip with the day's MVPs beside it (lib/eventLatest). The full
 * feed is on Feed & chat, and firsts, luck and the numbers are on Stats; this only points at them.
 */

const TAG: Record<LatestTag, { label: string; cls: string }> = {
  step: { label: 'Step', cls: 'border-gold/40 text-gold-light' },
  tile: { label: 'Tile', cls: 'border-gold/40 text-gold-light' },
  drop: { label: 'Drop', cls: 'border-sky-400/40 text-sky-300' },
  pet: { label: 'Pet', cls: 'border-sky-400/40 text-sky-300' },
  log: { label: 'Log', cls: 'border-sky-400/40 text-sky-300' },
  death: { label: 'Death', cls: 'border-red-400/40 text-red-300' },
  milestone: { label: 'Milestone', cls: 'border-accent-green/40 text-accent-green' },
};

export interface LatestMvp {
  label: string;
  name: string;
  /** "6 tasks" / "42 pts" */
  score: string;
}

export default function EventLatest({
  lines,
  feedHref,
  statsHref,
  mvps,
  children,
}: {
  lines: LatestLine[];
  /** Feed & chat, for those who have that tab. */
  feedHref: string | null;
  statsHref: string | null;
  mvps: LatestMvp[];
  /** The full moments list, for viewers with no Feed & chat tab to open. */
  children?: ReactNode;
}) {
  if (lines.length === 0 && mvps.length === 0) return null;
  const aside = mvps.length > 0 || statsHref;
  return (
    <div className={`mt-8 grid items-start gap-6 ${aside ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
      {lines.length > 0 && (
        <section aria-label="Latest" className="min-w-0 rounded-2xl border border-card-border bg-card-bg p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
              Latest
            </h2>
            {feedHref && (
              <ClanLink href={feedHref} className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-light sm:min-h-0">
                Open the full feed and chat
              </ClanLink>
            )}
          </div>
          <ul className="mt-2">
            {lines.map((l) => (
              <li key={l.key} className="flex items-baseline justify-between gap-3 border-t border-card-border/60 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className={`mr-2 inline-block rounded border px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide ${TAG[l.tag].cls}`}>{TAG[l.tag].label}</span>
                  <b>{l.who}</b> {l.text}
                  {l.detail && <span className="ml-1.5 text-text-muted">{l.detail}</span>}
                </span>
                {l.at && <LocalTime date={l.at} format="short" className="shrink-0 text-xs text-text-muted" />}
              </li>
            ))}
          </ul>
          {children && (
            <details className="mt-2 border-t border-card-border/60 pt-2">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-gold hover:text-gold-light">Show all moments</summary>
              <div className="mt-3">{children}</div>
            </details>
          )}
        </section>
      )}
      {aside && (
        <aside aria-label="Today" className="min-w-0 rounded-2xl border border-card-border bg-card-bg p-4 sm:p-5">
          <h2 className="text-[15px] font-bold">Today</h2>
          {mvps.map((m) => (
            <div key={m.label} className="mt-3 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-text-muted">{m.label}</span>
              <span className="min-w-0 truncate text-right">
                <b>{m.name}</b> <span className="text-text-muted">· {m.score}</span>
              </span>
            </div>
          ))}
          {statsHref && (
            <p className="mt-3 text-xs text-text-muted">
              Firsts, luck and the full numbers are on{' '}
              <ClanLink href={statsHref} className="text-gold hover:text-gold-light">
                Stats
              </ClanLink>
              .
            </p>
          )}
        </aside>
      )}
    </div>
  );
}
