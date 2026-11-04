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
import HostClient from './HostClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Host an event',
  description: 'Run an OSRS bingo or tile race for your viewers — no in-game clan needed.',
};

/**
 * "Host an event" — a creator space for somebody with an audience and no in-game clan
 * (lib/creatorSpaces). Apex only, like /clans/new: making a space is a platform act.
 *
 * Short on purpose: a name (their Discord name to start with), an address, two optional stream
 * links. Everything else happens in the event wizard, which is where pressing the button lands.
 */
export default async function HostPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const session = await verifyUser();
  const [userRow, existing] = session
    ? await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { displayName: true, discordUsername: true } }),
        ownedCreatorSpace(session.userId),
      ])
    : [null, null];
  const defaultName = (userRow?.displayName || userRow?.discordUsername || '').trim();

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        <h1 className="display text-2xl font-semibold">Host an event</h1>
      </div>
      <p className="mt-2 text-[15px] text-text-muted">
        Run a bingo for your viewers. No clan needed.{' '}
        <ClanLink href="/guide/creators" className="text-gold hover:text-gold-light">
          How it works
        </ClanLink>
      </p>

      <div className="mt-6">
        {existing ? (
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-lg font-semibold text-gold">You already have a space: {existing.name}</h2>
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
            defaultName={defaultName}
            defaultSlug={suggestSlug(defaultName)}
          />
        )}
      </div>

      <p className="mt-6 text-[13px] text-text-dim">
        Running an in-game clan instead?{' '}
        <ClanLink href="/clans/new" className="text-gold hover:text-gold-light">
          Start a clan
        </ClanLink>
      </p>
    </div>
  );
}
