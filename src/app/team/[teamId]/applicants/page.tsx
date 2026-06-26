import { db } from '@/db';
import { events, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyUser } from '@/lib/auth';
import ApplicantsClient from './ApplicantsClient';

export const dynamic = 'force-dynamic';

export default async function ApplicantsPage({
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

  return (
    <div>
      <Link
        href={`/team/${tId}`}
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; Back to team
      </Link>
      <h1 className="text-2xl font-bold text-gold mb-1">Applicants</h1>
      <p className="text-text-muted text-sm mb-6">
        Everyone signed up for {event.name}. Review their answers and stats to plan your picks.
      </p>
      <ApplicantsClient teamId={tId} />
    </div>
  );
}
