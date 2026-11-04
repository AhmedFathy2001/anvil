import { and, count, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { events, eventSignups } from '@/db/schema';
import ClanLink from '@/components/ClanLink';
import CopyLinkButton from '@/components/CopyLinkButton';
import SetupChecklist from '@/components/SetupChecklist';
import { creatorPlayers } from '@/lib/creatorHome';
import { pendingRequestCountsByEvent } from '@/lib/guestAdmission';
import type { SetupStatus } from '@/lib/setupStatus';
import CreatorPlayers from '../people/CreatorPlayers';
import StreamOverlayCard from './StreamOverlayCard';

function when(stamp: string | null): string {
  if (!stamp) return 'Not scheduled';
  const t = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

/**
 * A creator space's landing (lib/creatorSpaces): their events with an invite link each, a big "new
 * event" button, and who has joined. Nothing about rosters, weeklies, fees or Discord up front.
 */
export default async function CreatorDashboard({ clanId, setup }: { clanId: number; setup: SetupStatus }) {
  const [list, players, waiting] = await Promise.all([
    db
      .select({ id: events.id, name: events.name, startDate: events.startDate })
      .from(events)
      .where(eq(events.clanId, clanId))
      .orderBy(desc(events.id))
      .limit(20),
    creatorPlayers(clanId),
    pendingRequestCountsByEvent(clanId),
  ]);
  // How many joined each, in one grouped read (pending and approved — both are on the board).
  const counts = list.length
    ? await db
        .select({ eventId: eventSignups.eventId, n: count() })
        .from(eventSignups)
        .where(and(inArray(eventSignups.eventId, list.map((e) => e.id)), inArray(eventSignups.status, ['pending', 'approved'])))
        .groupBy(eventSignups.eventId)
    : [];
  const joinedBy = new Map(counts.map((c) => [c.eventId, c.n]));
  const rows = list.map((e) => ({ ...e, joined: joinedBy.get(e.id) ?? 0, waiting: waiting.get(e.id) ?? 0 }));

  return (
    <div className="max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-3xl font-semibold sm:text-4xl">Your events</h1>
        <ClanLink
          href="/admin/events/first"
          className="rounded-xl bg-gold px-5 py-3 text-base font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          + New event
        </ClanLink>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="text-lg font-semibold">No events yet</p>
          <ClanLink
            href="/admin/events/first"
            className="mt-4 inline-block rounded-xl bg-gold px-6 py-3 text-base font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            Create your first event
          </ClanLink>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
          {rows.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-3 border-t border-card-border/70 px-4 py-3.5 first:border-t-0"
            >
              <ClanLink href={`/admin/events/${e.id}`} className="min-w-0 flex-1 hover:text-gold">
                <span className="block truncate font-semibold">{e.name}</span>
                <span className="block text-[13px] text-text-muted">
                  {when(e.startDate)} · {e.joined} joined
                </span>
              </ClanLink>
              {e.waiting > 0 && (
                <ClanLink
                  href={`/admin/events/${e.id}/signups`}
                  className="shrink-0 rounded-lg bg-gold px-3.5 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                >
                  {e.waiting} waiting for you
                </ClanLink>
              )}
              <CopyLinkButton
                path={`/events/${e.id}`}
                label="Copy invite link"
                className="shrink-0 rounded-lg border border-gold/40 bg-gold/10 px-3.5 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
              />
              {/* OBS links for this event; opens into a full-width panel under the row. */}
              <StreamOverlayCard eventId={e.id} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <CreatorPlayers players={players} title="Who joined" />
      </div>

      {!setup.allDone && !setup.dismissed && (
        <div className="mt-8">
          <SetupChecklist steps={setup.steps} completedCount={setup.completedCount} totalCount={setup.totalCount} creator />
        </div>
      )}
    </div>
  );
}
