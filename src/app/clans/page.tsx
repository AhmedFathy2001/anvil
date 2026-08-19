import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { directoryClans } from '@/lib/apexDirectory';
import { isApexHost } from '@/lib/clanContext';
import ApexDirectory from '@/components/ApexDirectory';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clans on Anvil',
  description: 'Clans running bingos, weekly competitions and rosters on Anvil.',
};

/**
 * The clan directory at its own address.
 *
 * The apex home already shows this, but /clans is where it was on the control plane — a public URL
 * that outlives the app that served it — and it is what /c/<slug> links back to. A back-link to `/`
 * would work and read as "home", which is not the same as "the list I came from".
 */
export default async function ClansPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();
  return <ApexDirectory clans={await directoryClans()} />;
}
