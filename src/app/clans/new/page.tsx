import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { apexDomain, isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import NewClanClient from './NewClanClient';

export const dynamic = 'force-dynamic';

/**
 * Create a clan — on the apex only.
 *
 * Not reachable from inside a clan's site: making a clan is a platform act, and offering it on
 * someone else's subdomain would read as that clan's doing.
 */
export default async function NewClanPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Start a clan</h1>
      <p className="mt-1 text-sm text-gray-400">
        Free, and live the moment you press the button. Add members with the RuneLite plugin&rsquo;s
        roster sync, or by hand.
      </p>
      <div className="mt-6">
        <NewClanClient apex={apexDomain()} signedIn={session != null} />
      </div>
    </div>
  );
}
