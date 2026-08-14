'use client';

import type { FeedItem } from '@/lib/ladderInsights';
import type { LadderHallCard } from '@/lib/ladderView';

/**
 * The two things a rolling board needs that a one-shot event doesn't: a memory, and a pulse.
 *
 * A ladder that only ever shows the current month throws away its own history at every reset — and
 * the history (who won June, the longest streak anyone has managed) is exactly what makes the next
 * season worth entering. The feed is the other half: on a board where tasks rotate, "what just
 * happened" is as much of the state as the standings are.
 */

export function HallOfLadder({ hall }: { hall: { title: string; note: string; cards: LadderHallCard[] } }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <span className="h-5 w-1 rounded-full bg-gold" />
          {hall.title}
        </h2>
        <span className="text-xs text-text-muted">{hall.note}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {hall.cards.map((c) => (
          <div key={c.key} className="rounded-xl border border-card-border bg-card-bg p-4">
            <div className="text-[10px] uppercase tracking-widest text-text-muted">{c.label}</div>
            <div className="mt-2 break-words text-base font-bold text-gold-light">{c.value}</div>
            <div className="mt-1 text-xs text-text-muted">{c.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ago(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ActivityFeed({ feed, nowMs }: { feed: FeedItem[]; nowMs: number }) {
  if (feed.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="h-4 w-1 rounded-full bg-gold" />
        As it happens
      </h3>
      <div className="rounded-xl border border-card-border bg-card-bg p-1.5">
        {feed.map((f, i) => (
          <div key={`${f.kind}-${f.at}-${i}`} className="flex items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-xs">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                f.kind === 'claim' ? 'bg-accent-green-light' : f.kind === 'opened' ? 'bg-gold' : 'bg-amber-400'
              }`}
              aria-hidden
            />
            <span className="min-w-0 flex-1 text-text-muted">
              {f.kind === 'claim' ? (
                <>
                  <span className="font-semibold text-foreground">{f.playerName ?? 'A team'}</span> claimed{' '}
                  {f.tileLabel}{' '}
                  {f.points !== undefined && (
                    <span className="font-mono font-bold text-accent-green-light">+{Math.round(f.points).toLocaleString()}</span>
                  )}
                </>
              ) : f.kind === 'opened' ? (
                <>
                  <span className="font-semibold text-foreground">{f.tileLabel}</span> opened
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{f.tileLabel}</span> rotated out
                </>
              )}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-text-muted" suppressHydrationWarning>
              {ago(f.at, nowMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
