import { loadEventCards } from '@/lib/eventCards';
import EventsIndexClient from './EventsIndexClient';

export const dynamic = 'force-dynamic';

/**
 * Every event the clan has run.
 *
 * There was no such page: "Events" in the nav pointed at the home page, because the home page was
 * the event list. Now that home is the clan's dashboard, this is where the list lives — and it
 * carries the same card, from the same derivation, so the two can't disagree about who's winning.
 */
export default async function EventsIndexPage() {
  const events = await loadEventCards({ includeUpcoming: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gold sm:text-3xl">Events</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bingos, ladders and tile races — running now and everything already finished.
        </p>
      </div>
      <EventsIndexClient events={events} />
    </div>
  );
}
