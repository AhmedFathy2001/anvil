import { db } from '@/db';
import { clanMembers } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyUser } from '@/lib/auth';
import { isWellFormedToken } from '@/lib/teamInvites';
import { resolveInvite } from '@/lib/teamInvitesStore';
import JoinClient from './JoinClient';

export const dynamic = 'force-dynamic';

/**
 * What someone sees when a friend pastes them a team link.
 *
 * The audience is a player from ANOTHER clan who has never seen this site. So the page answers the
 * three things they actually want to know — which event, which team, and what happens if I click —
 * before it asks them for anything, and every refusal says who can fix it rather than just "no".
 */
export default async function JoinTeamPage({
  params,
}: {
  params: Promise<{ eventId: string; token: string }>;
}) {
  const { eventId, token } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id) || !isWellFormedToken(token)) notFound();

  const session = await verifyUser();
  if (!session) {
    // Straight back here after Discord, not to a generic landing page — they were handed a link to
    // a team, and losing that on the way through login is how an invite quietly becomes a draft entry.
    redirect(`/login?return=/events/${eventId}/join/${token}`);
  }

  const resolved = await resolveInvite(id, token);

  const myAccounts = await db
    .select({
      id: clanMembers.id,
      rsn: clanMembers.rsn,
      isPrimary: clanMembers.isPrimary,
      verifiedAt: clanMembers.verifiedAt,
    })
    .from(clanMembers)
    .where(and(eq(clanMembers.userId, session.userId), isNull(clanMembers.leftAt)));

  const verified = myAccounts.filter((a) => a.verifiedAt);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-card-border bg-card-bg p-6">
        <p className="text-xs uppercase tracking-wide text-text-muted">You were invited to</p>
        <h1 className="mt-1 text-2xl font-bold">
          {resolved.teamName ?? 'a team'}
          {resolved.teamColor && (
            <span
              aria-hidden
              className="ml-2 inline-block h-3 w-3 rounded-sm align-middle"
              style={{ backgroundColor: resolved.teamColor }}
            />
          )}
        </h1>
        {resolved.eventName && <p className="mt-0.5 text-sm text-text-muted">{resolved.eventName}</p>}

        {!resolved.check.ok ? (
          <div className="mt-5 rounded-lg border border-card-border bg-brown-dark/40 p-4">
            <p className="text-sm">{resolved.check.message}</p>
            <Link href={`/events/${id}`} className="mt-3 inline-block text-sm text-gold hover:underline">
              See the event instead →
            </Link>
          </div>
        ) : verified.length === 0 ? (
          // A link can't stand in for verification: the roster has to know the account is theirs.
          <div className="mt-5 rounded-lg border border-card-border bg-brown-dark/40 p-4">
            <p className="text-sm">
              You need a verified RuneScape name on this clan&apos;s roster before you can join a team.
            </p>
            <Link href="/profile" className="mt-3 inline-block text-sm text-gold hover:underline">
              Set that up on your profile →
            </Link>
          </div>
        ) : (
          <JoinClient
            eventId={id}
            token={token}
            teamName={resolved.teamName ?? 'the team'}
            accounts={verified}
            seatsLeft={resolved.check.seatsLeft}
          />
        )}
      </div>
    </div>
  );
}
