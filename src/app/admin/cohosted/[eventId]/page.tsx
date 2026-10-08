import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, eventCohosts, events, teams } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import { cohostSignupClanFor } from '@/lib/eventEditors';
import ClanLink from '@/components/ClanLink';
import EventDiscordServerPanel from '@/components/EventDiscordServerPanel';
import CohostSignupsClient from './CohostSignupsClient';

export const dynamic = 'force-dynamic';

/**
 * A co-hosted board, as seen from the CO-HOST's own admin.
 *
 * The event is the host's and everything that runs it — dates, draft, teams, visibility, who else
 * co-hosts — stays in the host's admin. What belongs to this clan is collected here instead of
 * sending its staff across into the host's: its own members' sign-ups, its team, the board when the
 * host has let its staff author it, and its side of the event's Discord.
 */
export default async function CohostedEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!Number.isInteger(id)) notFound();
  const [session, clan] = await Promise.all([verifyUser(), requireClan()]);
  if (!session) redirect(await clanHref('/login'));

  // clan-scope: global -- the seat row below proves this clan co-hosts it; nothing renders otherwise.
  const [row] = await db
    .select({ event: events, seat: eventCohosts, hostSlug: clans.slug, hostName: clans.name })
    .from(eventCohosts)
    .innerJoin(events, eq(events.id, eventCohosts.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    .where(and(eq(eventCohosts.eventId, id), eq(eventCohosts.clanId, clan.id), eq(eventCohosts.status, 'accepted')))
    .limit(1);
  if (!row) notFound();
  // The same seat the sign-up routes accept — moderator and up in this clan, or an operator acting
  // as one. A board-only editor has its own route in (the Tiles link), not this page.
  if ((await cohostSignupClanFor(id, session.userId)) !== clan.id) redirect(await clanHref('/admin/events'));

  const { event, seat, hostSlug, hostName } = row;
  const [ownTeam] = seat.teamId
    ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, seat.teamId)).limit(1)
    : [];
  const isAdmin = atLeast(session.role, 'admin');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <ClanLink href="/admin/events" className="text-sm text-text-muted hover:text-gold">← All events</ClanLink>
        <h1 className="mt-1 text-2xl font-bold text-gold">{event.name}</h1>
        <p className="text-sm text-text-muted">
          Co-hosted with <b className="text-foreground">{hostName}</b>. The host runs the event itself — dates, draft,
          teams and who can enter. This page is your clan’s part of it.
        </p>
      </div>

      <section className="rounded-xl border border-card-border bg-card-bg p-5">
        <h2 className="mb-3 text-lg font-bold">Your clan’s sign-ups</h2>
        <CohostSignupsClient eventId={id} hostSlug={hostSlug} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <h2 className="mb-1 font-bold">The board</h2>
          {seat.staffCanEditBoard ? (
            <>
              <p className="mb-3 text-sm text-text-muted">{hostName} lets your staff author the tiles with them.</p>
              <ClanLink href={`/c/${hostSlug}/admin/events/${id}/tiles`} className="text-sm font-semibold text-gold hover:underline">
                Edit the board →
              </ClanLink>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              Only {hostName} edits the tiles on this one. They can let your staff in from the board’s Teams tab.
            </p>
          )}
          <div className="mt-2">
            <ClanLink href={`/events/${id}`} className="text-sm text-text-muted hover:text-gold">View the board →</ClanLink>
          </div>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <h2 className="mb-1 font-bold">Your team</h2>
          {ownTeam ? (
            <>
              <p className="mb-3 text-sm text-text-muted">Roster, subs, proof and your players’ fees for {ownTeam.name}.</p>
              <ClanLink href={`/team/${ownTeam.id}`} className="text-sm font-semibold text-gold hover:underline">
                Manage {ownTeam.name} →
              </ClanLink>
            </>
          ) : (
            <p className="text-sm text-text-muted">Your clan has no team of its own on this board — players are drafted across clans.</p>
          )}
        </div>
      </section>

      {isAdmin ? (
        <EventDiscordServerPanel eventId={id} />
      ) : (
        <p className="text-sm text-text-muted">Your clan’s admins set up this event’s Discord from here.</p>
      )}
    </div>
  );
}
