'use client';

import { useMemo, useState } from 'react';
import EventCardTile from '@/components/events/EventCardTile';
import type { EventCard } from '@/lib/eventCards';

/**
 * The events index.
 *
 * "Events" in the nav used to point at the home page, because the home page WAS the event list.
 * Now that home is the clan's dashboard, events need somewhere of their own — and once a clan has
 * run twenty of them, that place needs filters rather than one long wall.
 */

const STATUS: { key: 'all' | 'live' | 'upcoming' | 'past'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Finished' },
];

const FORMATS: { key: 'all' | EventCard['format']; label: string }[] = [
  { key: 'all', label: 'Every format' },
  { key: 'bingo', label: 'Bingo' },
  { key: 'ladder', label: 'Ladder' },
  { key: 'tilerace', label: 'Tile race' },
];

export default function EventsIndexClient({
  events,
  pastTotal,
}: {
  events: EventCard[];
  /** How many finished events exist in total — the page only loads a page of them. */
  pastTotal?: number;
}) {
  const [status, setStatus] = useState<(typeof STATUS)[number]['key']>('all');
  const [format, setFormat] = useState<(typeof FORMATS)[number]['key']>('all');
  const [query, setQuery] = useState('');

  // The archive is paged, so "Finished" counts what EXISTS, not what happens to be loaded —
  // a chip reading 24 next to a page that says "24 of 291" would just be wrong.
  const counts = useMemo(() => {
    const loadedPast = events.filter((e) => e.status === 'past').length;
    const past = pastTotal ?? loadedPast;
    return {
      all: events.length - loadedPast + past,
      live: events.filter((e) => e.status === 'live').length,
      upcoming: events.filter((e) => e.status === 'upcoming').length,
      past,
    };
  }, [events, pastTotal]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (status === 'all' || e.status === status) &&
        (format === 'all' || e.format === format) &&
        (q === '' || e.name.toLowerCase().includes(q) || e.shape.toLowerCase().includes(q)),
    );
  }, [events, status, format, query]);

  // Live first, then what's coming, then the archive newest-first — the order you'd ask for them in.
  const grouped = useMemo(() => {
    const order = { live: 0, upcoming: 1, past: 2 } as const;
    return [...shown].sort(
      (a, b) => order[a.status] - order[b.status] || (b.startDate ?? '').localeCompare(a.startDate ?? ''),
    );
  }, [shown]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex overflow-hidden rounded-lg border border-card-border text-xs font-semibold">
          {STATUS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatus(s.key)}
              aria-pressed={status === s.key}
              className={`px-3 py-1.5 transition-colors ${
                status === s.key ? 'bg-gold text-brown-dark' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {s.label}
              <span className={`ml-1.5 ${status === s.key ? 'text-brown-dark/70' : 'text-text-muted/70'}`}>
                {counts[s.key]}
              </span>
            </button>
          ))}
        </span>

        <span className="inline-flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFormat(f.key)}
              aria-pressed={format === f.key}
              className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors ${
                format === f.key
                  ? 'border-gold/60 bg-gold/15 text-gold-light'
                  : 'border-card-border text-text-muted hover:border-gold/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </span>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          aria-label="Search events"
          className="ml-auto min-w-[180px] flex-1 rounded-lg border border-card-border bg-brown-dark px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-gold/50 focus:outline-none sm:max-w-xs sm:flex-none"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border py-14 text-center text-sm text-text-muted">
          {events.length === 0 ? 'No events yet — an admin can start one from the Admin tab.' : 'Nothing matches that.'}
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
          {grouped.map((e) => (
            <EventCardTile key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
