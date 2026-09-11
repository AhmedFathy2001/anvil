import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import WarRoomClient from './WarRoomClient';
import { clanHref } from '@/lib/clanPath';
import { resolveTeamManagement } from '@/lib/teamStaff';
import ClanLink from '@/components/ClanLink';
import { idParam } from '@/lib/routeIds';

export const dynamic = 'force-dynamic';

/**
 * The captain's war room. Same URL as the old applicants list — the links to it are already in the
 * wild — but the page is now the pool with everything known about it, plus the captain's own
 * shortlist, rather than a flat list of sign-ups in two buckets.
 */
export default async function WarRoomPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const tId = idParam(teamId);

  const user = await verifyUser();
  if (!user) redirect(`/login?return=${encodeURIComponent(await clanHref(`/team/${tId}/applicants`))}`);

  const team = await db.query.teams.findFirst({ where: eq(teams.id, tId) });
  if (!team) notFound();
  // WHOEVER MANAGES THE TEAM, which is the captain OR a team-staff seat. It read `captainUserId`
  // alone, and the seat exists for exactly the person that shut out: a visiting clan's moderator,
  // handed their own half of a co-hosted board. They could see the board listed on their clan's
  // events page, could not open the host's admin (the event is not their clan's), and were bounced
  // off the one surface built for them. Every other team-scoped action — invites, fees — already
  // asks this way; the war room was the one that did not.
  const management = await resolveTeamManagement(tId);
  if (!management?.canManage) redirect(await clanHref(`/team/${tId}`));

  // clan-scope: global -- a team is reached through membership or an invite token, not through a clan — that is what lets a visiting clan's people use it.
  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) notFound();

  const drafting = event.draftStatus === 'active' || event.draftStatus === 'paused';

  return (
    <div className="max-w-6xl mx-auto">
      <ClanLink
        href={`/team/${tId}`}
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; Back to team
      </ClanLink>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-bold text-gold">War room</h1>
        <span className="text-sm text-text-muted">
          {event.name}
          {drafting && ' · draft in progress'}
        </span>
      </div>
      <p className="text-text-muted text-sm mb-6 max-w-[70ch]">
        Everyone you could take, what they told you at sign-up, and what they&rsquo;ve done here before.
        Build the order you want them in — it&rsquo;s private, and it&rsquo;s what the pick button follows
        once you&rsquo;re on the clock.
      </p>
      <WarRoomClient teamId={tId} />
    </div>
  );
}
