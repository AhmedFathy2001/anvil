import ClanEventsClient from './ClanEventsClient';

export const dynamic = 'force-dynamic';

/**
 * Clan events: what the clan hosts that nothing tracks — a weekly boss mass, a skilling hangout, a
 * drop party. A name, a time, a place. Announced in Discord (and edited in place), reminded 15
 * minutes out and at the start, listed on the site and in the plugin, with "I'm going" (lib/clanEvents).
 */
export default function ClanEventsPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-gold sm:text-3xl">Clan events</h1>
        <p className="text-sm text-text-muted">
          Boss masses, hangouts, drop parties — anything the clan hosts that doesn&rsquo;t need tracking. Each one is
          posted to Discord, reminded 15 minutes before and when it starts, and shown in the plugin&rsquo;s Clan tab.
        </p>
      </header>
      <ClanEventsClient />
    </div>
  );
}
