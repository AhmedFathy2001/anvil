'use client';

import { useState } from 'react';

import { LuckColumns } from '@/app/members/ClanLuck';
import type { EventLuck as EventLuckData } from '@/lib/eventLuck';

/**
 * Who the game was kind to during this event, and who it wasn't — and, a click away, the same people
 * across their whole collection log. Event luck counts only the plugin's own drops since the start,
 * so it judges only players whose plugin was running; the line under the toggle says how many.
 */
export default function EventLuck({ luck }: { luck: EventLuckData }) {
  const [view, setView] = useState<'event' | 'lifetime'>('event');
  const { thisEvent, lifetime } = luck;
  const nothing =
    thisEvent.dry.length + thisEvent.spooned.length + lifetime.dry.length + lifetime.spooned.length === 0;
  if (nothing) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="h-5 w-1 bg-gold" />
          Luck
        </h2>
        <div className="flex rounded-lg border border-card-border p-0.5 text-xs" role="tablist">
          {(['event', 'lifetime'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                view === v ? 'bg-gold/20 text-gold' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {v === 'event' ? 'This event' : 'Lifetime'}
            </button>
          ))}
        </div>
      </div>

      {view === 'event' ? (
        <>
          <p className="mb-3 text-xs text-text-muted">
            Drops since the start against kills since the start, for the {thisEvent.judged} of{' '}
            {thisEvent.participants} players whose plugin was running. Without it we can&rsquo;t see their drops, so
            they aren&rsquo;t judged.
          </p>
          <LuckColumns
            dry={thisEvent.dry}
            spooned={thisEvent.spooned}
            kcLabel="KC this event"
            emptyDry="Nobody is far enough behind on this event's kills to call it."
            emptySpooned="Nobody is far enough ahead on this event's kills to call it. Yet."
          />
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-text-muted">
            The same players across their whole collection log, for the {lifetime.membersConsidered} who have synced one.
          </p>
          <LuckColumns dry={lifetime.dry} spooned={lifetime.spooned} />
        </>
      )}
    </section>
  );
}
