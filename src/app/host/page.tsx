import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { apexDomain, isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { ownedCreatorSpace } from '@/lib/clanCreate';
import { suggestSlug } from '@/lib/creatorSpaces';
import ClanLink from '@/components/ClanLink';
import { FRIENDS_CAPS } from '@/lib/friendEventRules';
import { friendsHostOf, hostingTierOf } from '@/lib/friendEvents';
import { SUPPORTER_TIERS } from '@/lib/supporterTiers';
import { hostPlanParam } from '@/lib/creatorPricingCta';
import { parseBillingInterval } from '@/lib/billingInterval';
import HostClient from './HostClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Host an event',
  description: 'Run an OSRS bingo or tile race for your friends or your viewers — no in-game clan needed.',
};

/**
 * "Host an event" — two ways to host with no in-game clan, side by side so each is easy to find:
 *
 *   FOR FRIENDS  a Supporter perk (lib/friendEventRules): private boards, invite link only, sized by
 *                the person's tier. Lives at /host/friends, on their hidden friends host.
 *   FOR VIEWERS  a creator space (lib/creatorSpaces): a public page, stream links, gates, overlay.
 *
 * They never share a cap: a creator who is also a Patron sees, and gets, both. Apex only, like
 * /clans/new: making either is a platform act.
 */
export default async function HostPage({ searchParams }: { searchParams: Promise<{ plan?: string; billing?: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  // A paid column on /pricing: the new space lands on its plan card (that tier's checkout) instead of
  // the event wizard. ?billing=yearly rides along so the card opens on the yearly price.
  const sp = await searchParams;
  const plan = hostPlanParam(sp.plan);
  const billing = parseBillingInterval(sp.billing);
  const session = await verifyUser();
  const [userRow, existing, tier, friendsHost] = session
    ? await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { displayName: true, discordUsername: true } }),
        ownedCreatorSpace(session.userId),
        hostingTierOf(session.userId),
        friendsHostOf(session.userId),
      ])
    : [null, null, null, null];
  const defaultName = (userRow?.displayName || userRow?.discordUsername || '').trim();
  const caps = tier ? FRIENDS_CAPS[tier] : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        <h1 className="display text-2xl font-semibold">Host an event</h1>
      </div>
      <p className="mt-2 text-[15px] text-text-muted">Run a bingo or a race. No clan needed. Pick who it&rsquo;s for.</p>

      {/* ── For friends ─────────────────────────────────────────────────────────────────────── */}
      <section className="mt-6 rounded-xl border border-card-border bg-card-bg p-6" aria-labelledby="host-friends">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="host-friends" className="text-lg font-semibold text-gold">
            Host for friends
          </h2>
          <span className="rounded-full border border-gold/30 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-gold/85">
            Supporter perk
          </span>
        </div>
        <p className="mt-2 text-sm text-text-muted">
          A private board for your group. Only people with your invite link can join, and it never shows up anywhere public.
        </p>
        {caps && tier ? (
          <>
            <p className="mt-3 text-sm">
              As a {SUPPORTER_TIERS[tier].name}: up to <span className="font-semibold">{caps.playersPerEvent} players</span>, and{' '}
              {caps.liveEvents === 1 ? 'one event' : `${caps.liveEvents} events`} running at a time.
            </p>
            <div className="mt-4">
              <ClanLink
                href="/host/friends"
                className="inline-block rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
              >
                Host for friends
              </ClanLink>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-text-muted">
              Supporters host up to {FRIENDS_CAPS.supporter.playersPerEvent} players, Champions {FRIENDS_CAPS.champion.playersPerEvent},
              Patrons {FRIENDS_CAPS.patron.playersPerEvent}. Joining someone else&rsquo;s is always free.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ClanLink
                href="/supporter"
                className="inline-block rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
              >
                Become a Supporter
              </ClanLink>
              {/* A lapsed Supporter still has their events (and their players) there. */}
              {friendsHost && (
                <ClanLink
                  href="/host/friends"
                  className="inline-block rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold transition-colors hover:border-gold"
                >
                  Your friends events
                </ClanLink>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── For viewers ─────────────────────────────────────────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="host-viewers">
        <h2 id="host-viewers" className="text-lg font-semibold">
          Host for your viewers
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          A creator space: your own page, stream links and events anyone can join.{' '}
          <ClanLink href="/guide/creators" className="text-gold hover:text-gold-light">
            How it works
          </ClanLink>
        </p>
        <div className="mt-4">
          {existing ? (
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <h3 className="text-lg font-semibold text-gold">You already have a space: {existing.name}</h3>
              <p className="mt-2 text-sm text-text-muted">Make your next event there.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <ClanLink
                  href={`/c/${existing.slug}/admin/events/first`}
                  className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                >
                  New event
                </ClanLink>
                <ClanLink
                  href={`/c/${existing.slug}`}
                  className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold transition-colors hover:border-gold"
                >
                  Your page
                </ClanLink>
              </div>
            </div>
          ) : (
            <HostClient
              apex={apexDomain()}
              signedIn={session != null}
              plan={plan}
              billing={billing}
              defaultName={defaultName}
              defaultSlug={suggestSlug(defaultName)}
            />
          )}
        </div>
      </section>

      <p className="mt-6 text-[13px] text-text-dim">
        Running an in-game clan instead?{' '}
        <ClanLink href="/clans/new" className="text-gold hover:text-gold-light">
          Start a clan
        </ClanLink>
      </p>
    </div>
  );
}
