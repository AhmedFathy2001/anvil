import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import FriendsInviteLink from '@/components/FriendsInviteLink';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { eventStage } from '@/lib/eventStage';
import { FRIENDS_CAPS } from '@/lib/friendEventRules';
import { friendsEventRows, friendsEventsFor, friendsPeakNow, hostingTierOf, type FriendsEventSummary } from '@/lib/friendEvents';
import { SUPPORTER_TIERS } from '@/lib/supporterTiers';
import NewFriendsEvent from './NewFriendsEvent';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Friends events',
  description: 'Your private Anvil events for friends.',
  robots: { index: false, follow: false },
};

/**
 * A Supporter's friends events (lib/friendEventRules): their own list, where they start one, copy
 * its invite link and open it to manage. Apex only; the boards themselves live on the person's
 * hidden friends host (/c/<slug>/…), which has no page of its own — this is its home.
 */
export default async function FriendsEventsPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const session = await verifyUser();
  if (!session || session.userId <= 0) redirect(`/login?return=${encodeURIComponent('/host/friends')}`);

  const [tier, mine] = await Promise.all([hostingTierOf(session.userId), friendsEventsFor(session.userId)]);
  const { host, events } = mine;
  const caps = tier ? FRIENDS_CAPS[tier] : null;
  const peak = host ? friendsPeakNow(await friendsEventRows(host.id)) : 0;
  const liveCount = events.filter((e) => e.live).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        <h1 className="display text-2xl font-semibold">Friends events</h1>
      </div>
      <p className="mt-2 text-[15px] text-text-muted">
        Private bingos and races for your group. Friends join with your invite link; nobody else can find them.
      </p>

      {caps && tier ? (
        <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-5">
          <p className="text-sm">
            As a <span className="font-semibold text-gold">{SUPPORTER_TIERS[tier].name}</span> you can have up to{' '}
            <span className="font-semibold">{caps.playersPerEvent} players</span> in your friends events at once, and{' '}
            {caps.liveEvents === 1 ? 'one event' : `${caps.liveEvents} events`} running at a time.
          </p>
          <p className="mt-1 text-[13px] text-text-dim">
            Events whose dates overlap share the {caps.playersPerEvent}; events that don&rsquo;t overlap each get all of them.
          </p>
          {host && (
            <p className="mt-3 text-[13px] text-text-muted">
              Booked from now on: <span className="font-semibold text-foreground">{peak}</span> of {caps.playersPerEvent} players ·{' '}
              {liveCount} of {caps.liveEvents} running
            </p>
          )}
          <div className="mt-4">
            <NewFriendsEvent />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-gold/30 bg-gold/[0.06] p-5">
          <h2 className="font-semibold">{host ? 'Your Supporter tier has ended' : 'Hosting for friends is a Supporter perk'}</h2>
          <p className="mt-1 text-sm text-text-muted">
            {host
              ? 'Your events keep everyone already in them. New friends can’t join and you can’t start a new one until you support again.'
              : `Supporters host up to ${FRIENDS_CAPS.supporter.playersPerEvent} players, Champions ${FRIENDS_CAPS.champion.playersPerEvent}, Patrons ${FRIENDS_CAPS.patron.playersPerEvent}. Joining a friend’s event is always free.`}
          </p>
          <ClanLink
            href="/supporter"
            className="mt-4 inline-block rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
          >
            Become a Supporter
          </ClanLink>
        </div>
      )}

      {host && events.length > 0 && (
        <section className="mt-8" aria-labelledby="friends-list">
          <h2 id="friends-list" className="text-lg font-semibold">
            Your events
          </h2>
          <ul className="mt-3 space-y-3">
            {events.map((e) => (
              <FriendsEventRow key={e.id} e={e} hostSlug={host.slug} />
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-[13px] text-text-dim">
        Hosting for your stream instead?{' '}
        <ClanLink href="/host" className="text-gold hover:text-gold-light">
          Make a creator space
        </ClanLink>
      </p>
    </div>
  );
}

function statusOf(e: FriendsEventSummary): { label: string; cls: string } {
  if (e.startDate == null && !e.forceEndedAt) return { label: 'Draft', cls: 'text-yellow-300 border-yellow-500/25 bg-yellow-500/10' };
  const stage = eventStage(e);
  if (stage === 'wrap') return { label: 'Finished', cls: 'text-text-muted border-text-muted/25 bg-text-muted/10' };
  if (stage === 'run') return { label: 'Live', cls: 'text-accent-green-light border-accent-green/25 bg-accent-green/10' };
  return { label: 'Upcoming', cls: 'text-blue-400 border-blue-500/25 bg-blue-500/10' };
}

function FriendsEventRow({ e, hostSlug }: { e: FriendsEventSummary; hostSlug: string }) {
  const status = statusOf(e);
  const over = status.label === 'Finished';
  return (
    <li className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{e.name}</div>
          <div className="text-[13px] text-text-muted">
            {e.seats} {e.seats === 1 ? 'player' : 'players'}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!over && e.inviteToken && <FriendsInviteLink eventId={e.id} token={e.inviteToken} apiBase={`/c/${hostSlug}`} compact />}
        <ClanLink
          href={`/c/${hostSlug}/admin/events/${e.id}`}
          className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-gold/40 hover:text-gold"
        >
          Manage
        </ClanLink>
        <ClanLink
          href={`/c/${hostSlug}/events/${e.id}`}
          className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-gold/40 hover:text-gold"
        >
          Board
        </ClanLink>
      </div>
    </li>
  );
}
