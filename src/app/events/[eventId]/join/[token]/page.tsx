import { redirect } from 'next/navigation';
import { db } from '@/db';
import { events, teamInvites, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { signupWindowState } from '@/lib/signup';
import { checkInvite, isWellFormedToken, invitePath } from '@/lib/teamInvites';
import { clanHref } from '@/lib/clanPath';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * The page an invite link opens (lib/teamInvites).
 *
 * It decides one thing — is this link still good — and then hands over to the ordinary sign-up
 * form carrying the token, so a person who arrives by link answers the same questions, picks the
 * same accounts and sees the same fee as everyone else. Only the destination differs: their entry
 * lands on the inviting team, approved, instead of in the draft pool waiting on a host.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ eventId: string; token: string }>;
}) {
  const { eventId, token } = await params;
  const id = parseInt(eventId, 10);

  const invite = Number.isInteger(id) && isWellFormedToken(token)
    ? await db.query.teamInvites.findFirst({ where: eq(teamInvites.token, token) })
    : null;

  const event = Number.isInteger(id)
    // clan-scope: global -- a team is reached through membership or an invite token, not through a clan — that is what lets a visiting clan's people use it.
    ? await db.query.events.findFirst({ where: eq(events.id, id) })
    : null;

  const window = event
    ? signupWindowState({
        signupOpensAt: event.signupOpensAt,
        signupDeadline: event.signupDeadline,
        startDate: event.startDate,
      })
    : { open: false, reason: 'closed' as const };

  const verdict = checkInvite(invite, { now: new Date().getTime(), eventId: id, signupsOpen: window.open });

  if (!verdict.ok || !invite || !event) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="border border-dashed border-card-border rounded-xl p-10 text-center">
          <p className="text-lg font-semibold mb-2">This invite can&apos;t be used</p>
          <p className="text-sm text-text-muted mb-6">{verdict.message}</p>
          <ClanLink
            href={event ? `/events/${event.id}` : '/events'}
            className="text-sm font-medium bg-gold/10 text-gold border border-gold/20 px-3 py-1.5 rounded-lg hover:bg-gold/20 transition-colors"
          >
            {event ? 'See the event' : 'See what’s running'}
          </ClanLink>
        </div>
      </div>
    );
  }

  // Signing in has to happen before the form, and the link is where they came from — so send them
  // back HERE afterwards rather than to the generic sign-up page, or the team gets lost on the way.
  const user = await verifyUser();
  if (!user) redirect(`/login?return=${encodeURIComponent(invitePath(id, token))}`);

  const team = await db.query.teams.findFirst({ where: eq(teams.id, invite.teamId) });
  if (!team) redirect(await clanHref(`/events/${id}`));

  redirect(await clanHref(`/events/${id}/signup?invite=${token}`));
}
