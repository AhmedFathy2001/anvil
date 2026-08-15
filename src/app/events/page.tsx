import Link from 'next/link';
import { countPastEvents, loadEventCards } from '@/lib/eventCards';
import EventsIndexClient from './EventsIndexClient';

export const dynamic = 'force-dynamic';

/**
 * Every event the clan has run.
 *
 * There was no such page: "Events" in the nav pointed at the home page, because the home page was
 * the event list. Now that home is the clan's dashboard, this is where the list lives — and it
 * carries the same card, from the same derivation, so the two can't disagree about who's winning.
 *
 * PAGED. Live and upcoming events are always all of them — a clan can run several boards at once
 * and every one of them is the point of the page. The archive is not: a clan two years in has
 * hundreds of finished events, and rendering all of them costs a query over the whole history and
 * a card wall nobody scrolls. So finished events come a page at a time, newest first.
 */
const PAGE = 24;

export default async function EventsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const requested = Number.parseInt(show ?? '', 10);
  const pastLimit = Number.isFinite(requested) ? Math.min(Math.max(requested, PAGE), 500) : PAGE;

  const [events, pastTotal] = await Promise.all([
    loadEventCards({ includeUpcoming: true, pastLimit }),
    countPastEvents(),
  ]);
  const shownPast = events.filter((e) => e.status === 'past').length;
  const more = pastTotal - shownPast;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gold sm:text-3xl">Events</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bingos, ladders and tile races — running now and everything already finished.
        </p>
      </div>
      <EventsIndexClient events={events} pastTotal={pastTotal} />

      {more > 0 && (
        <div className="mt-5 text-center">
          <Link
            href={`/events?show=${pastLimit + PAGE}`}
            scroll={false}
            className="inline-block rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Show {Math.min(PAGE, more)} more
            <span className="ml-2 text-text-muted/70">
              {shownPast} of {pastTotal} finished
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
