'use client';

import { useState } from 'react';
import ClanLink from '@/components/ClanLink';
import LocalTime from '@/components/LocalTime';
import { feedLineMatches, type CompetitionFeedDay, type CompetitionFeedLine, type FeedFilter, type FeedTag } from '@/lib/competitionFeed';
import { dateLabel } from './format';

/**
 * A competition's own feed (lib/competitionFeed): what happened at its bosses or in its skills, by
 * the people in it, day by day. No chat: a competition is a week of numbers, not a room.
 */

const TAGS: Record<FeedTag, { word: string; cls: string }> = {
  rank: { word: 'Rank', cls: 'border-gold/40 text-gold' },
  day: { word: 'Daily update', cls: 'border-gold/40 text-gold' },
  drop: { word: 'Drop', cls: 'border-sky-400/40 text-sky-300' },
  milestone: { word: 'Milestone', cls: 'border-accent-green/40 text-accent-green-light' },
  death: { word: 'Death', cls: 'border-red-400/40 text-red-300' },
};

function Line({ line }: { line: CompetitionFeedLine }) {
  const tag = TAGS[line.tag];
  return (
    <div className="flex items-start justify-between gap-3 border-t border-card-border/60 py-2.5 text-[13px] first:border-t-0">
      <span className="min-w-0 text-text-muted">
        <span className={`mr-2 inline-block rounded border px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide ${tag.cls}`}>{tag.word}</span>
        {line.rsn && <b className="font-semibold text-foreground">{line.rsn} </b>}
        <span className="text-foreground/90">{line.text}</span>
        {line.detail && <span className="ml-1.5 text-[11.5px] text-text-muted">{line.detail}</span>}
      </span>
      {line.at && <LocalTime date={line.at} format="short" className="shrink-0 font-mono text-[11px] text-text-muted" />}
    </div>
  );
}

const dayTitle = (d: CompetitionFeedDay) => `Day ${d.index + 1} · ${dateLabel(d.day)}`;

export default function CompetitionFeed({
  days,
  title,
  filters,
  canFilterMine,
  emptyNote,
}: {
  days: CompetitionFeedDay[];
  /** "At Zulrah", "In Agility": the scope, said as the heading. */
  title: string;
  /** The chips that mean something for this kind of competition. */
  filters: { key: FeedFilter; label: string }[];
  canFilterMine: boolean;
  emptyNote: string;
}) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const chips = canFilterMine ? [...filters, { key: 'mine' as const, label: 'Only me' }] : filters;
  const shown = days
    .map((d) => ({ ...d, lines: d.lines.filter((l) => feedLineMatches(l, filter)) }))
    .filter((d) => d.lines.length > 0);

  return (
    <section aria-label="Feed" className="rounded-2xl border border-card-border bg-card-bg p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          {title}
        </h2>
        {chips.length > 2 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter the feed">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={filter === c.key}
                onClick={() => setFilter(c.key)}
                className={`min-h-8 rounded-full border px-3 text-xs transition-colors max-sm:min-h-11 ${
                  filter === c.key ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:border-gold/50 hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">{days.length === 0 ? emptyNote : 'Nothing of that kind yet.'}</p>
      ) : (
        shown.map((d) => (
          <div key={d.day} className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">{dayTitle(d)}</div>
            <div className="mt-1">
              {d.lines.map((l) => (
                <Line key={l.key} line={l} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/** The newest few lines, on the Standings tab, with the way into the whole feed. */
export function CompetitionLatest({ days, href, limit = 5 }: { days: CompetitionFeedDay[]; href: string; limit?: number }) {
  const lines = days.flatMap((d) => d.lines).slice(0, limit);
  if (lines.length === 0) return null;
  return (
    <div className="mt-5 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold">Latest</h3>
        <ClanLink href={href} className="text-xs text-gold hover:text-gold-light max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
          Open the feed
        </ClanLink>
      </div>
      <div className="mt-1.5">
        {lines.map((l) => (
          <Line key={l.key} line={l} />
        ))}
      </div>
    </div>
  );
}

/**
 * Standings and Feed: a competition has no rules page and no chat, so these are its only two while
 * it runs. Once it has ended a Recap tab leads, and the page opens on it.
 */
export function CompetitionTabs({ competitionId, active, recap = false }: { competitionId: number; active: 'recap' | 'standings' | 'feed'; recap?: boolean }) {
  const tab = (key: 'recap' | 'standings' | 'feed', label: string, href: string) => (
    <ClanLink
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-4 text-sm transition-colors ${
        active === key ? 'border-gold font-semibold text-gold' : 'border-transparent text-text-muted hover:text-foreground'
      }`}
    >
      {label}
    </ClanLink>
  );
  return (
    <nav aria-label="Competition sections" className="mb-5 flex flex-wrap gap-1 border-b border-card-border">
      {recap && tab('recap', 'Recap', `/weekly/${competitionId}`)}
      {tab('standings', 'Standings', recap ? `/weekly/${competitionId}?view=standings` : `/weekly/${competitionId}`)}
      {tab('feed', 'Feed', `/weekly/${competitionId}?view=feed`)}
    </nav>
  );
}

/** What is counted and what the feed is kept to, in three lines. */
export function WhatCounts({ lines }: { lines: string[] }) {
  return (
    <div className="mt-5 rounded-xl border border-card-border bg-card-bg p-4">
      <h3 className="text-sm font-bold">What counts</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] text-text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
