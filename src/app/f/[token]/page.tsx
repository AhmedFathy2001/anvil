import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { canSeeEvent } from '@/lib/eventAccess';
import { inviteTarget } from '@/lib/friendEvents';
import { isInviteToken } from '@/lib/friendEventRules';
import AcceptInvite from './AcceptInvite';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'You’re invited',
  // A private link: never indexed, and no preview card naming the event.
  robots: { index: false, follow: false },
};

/**
 * A friends event's invite link (lib/friendEvents). Says whose event it is, signs the person in if
 * they are not, and on "Open the event" invites them to it — from there the event's own page joins
 * them in one press, like a creator space's viewers. Somebody who already can see it goes straight
 * there.
 */
export default async function FriendsInvitePage({ params }: { params: Promise<{ token: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const { token } = await params;
  const target = isInviteToken(token) ? await inviteTarget(token) : null;
  const session = await verifyUser();
  if (target) track('invite.opened', { userId: session?.userId ?? null, clanId: null });

  if (target && session?.playerId != null && (await canSeeEvent({ eventId: target.eventId, playerId: session.playerId }))) {
    redirect(`/c/${target.hostSlug}/events/${target.eventId}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-gold/30 bg-card-bg p-8 text-center">
        {target ? (
          <>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">Friends event</p>
            <h1 className="display mt-2 text-2xl font-semibold [text-wrap:balance]">{target.eventName}</h1>
            <p className="mt-2 text-sm text-text-muted">
              {target.ownerName ? `${target.ownerName} invited you to play.` : 'You’ve been invited to play.'} Tracked by the Anvil
              plugin, like any clan event.
            </p>
            <div className="mt-6">
              {session ? (
                <AcceptInvite token={token} />
              ) : (
                <ClanLink
                  href={`/login?return=${encodeURIComponent(`/f/${token}`)}`}
                  className="block w-full rounded-xl bg-gold px-6 py-4 text-lg font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                >
                  Sign in with Discord to join
                </ClanLink>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="display text-2xl font-semibold">This link doesn&rsquo;t work</h1>
            <p className="mt-2 text-sm text-text-muted">
              It may have been replaced with a new one. Ask whoever sent it for the latest link.
            </p>
            <ClanLink href="/" className="mt-6 inline-block text-sm text-gold hover:text-gold-light">
              Go to Anvil
            </ClanLink>
          </>
        )}
      </div>
    </div>
  );
}
