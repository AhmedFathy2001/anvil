import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyUser } from '@/lib/auth';
import WarRoomClient from './WarRoomClient';

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
  const tId = parseInt(teamId, 10);

  const user = await verifyUser();
  if (!user) redirect('/login');

  const team = await db.query.teams.findFirst({ where: eq(teams.id, tId) });
  if (!team) notFound();
  // Captain-only — players who aren't the captain bounce back to the team board.
  if (team.captainUserId !== user.userId) redirect(`/team/${tId}`);

  const event = await db.query.events.findFirst({ where: eq(events.id, team.eventId) });
  if (!event) notFound();

  const drafting = event.draftStatus === 'active' || event.draftStatus === 'paused';

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href={`/team/${tId}`}
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; Back to team
      </Link>
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
